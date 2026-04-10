/**
 * Multi-tenant webhook routing.
 *
 * When a webhook arrives from Meta (WhatsApp or Instagram), we need to figure
 * out which tenant owns the receiving phone number or page so we can:
 *   1. Use that tenant's access token to send replies.
 *   2. Load that tenant's agent config (persona, tools, scope).
 *
 * Resolution order:
 *   a) Search all tenants' agentConfig JSON for a matching channel identifier.
 *   b) Fall back to env-var credentials (the "default" tenant).
 *
 * Results are cached for 60 s so we don't query the DB on every webhook hit.
 */

import { db } from '@/lib/db';
import type { TenantAgentConfig } from '@/lib/agents/tenant-config';
import type { WhatsAppCredentials } from './whatsapp';
import { env } from '@/lib/config/env';
import { createLogger } from '@/lib/utils';

const log = createLogger('channels:tenant-resolver');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ResolvedWhatsAppTenant {
  tenantId: string;
  credentials: WhatsAppCredentials;
  agentConfig: TenantAgentConfig | null;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// ─── In-memory cache ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 60 s

/** phone_number_id → resolved tenant */
const waCache = new Map<string, CacheEntry<ResolvedWhatsAppTenant | null>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── WhatsApp tenant resolution ─────────────────────────────────────────────

/**
 * Resolve the tenant that owns a given WhatsApp phone_number_id.
 *
 * 1. Check DB: scan all active tenants' agentConfig for whatsappPhoneNumberId.
 * 2. Fallback: if the phone_number_id matches env.WHATSAPP_PHONE_NUMBER_ID
 *    (or no DB match found), use env-var credentials.
 *
 * Returns null only if no credentials exist at all.
 */
export async function resolveWhatsAppTenant(
  phoneNumberId: string,
): Promise<ResolvedWhatsAppTenant | null> {
  // ── Check cache ──
  const cached = getCached(waCache, phoneNumberId);
  if (cached !== undefined) return cached;

  // ── Query DB ──
  try {
    const tenants = await db.tenant.findMany({
      where: { isActive: true },
      select: { id: true, agentConfig: true },
    });

    for (const tenant of tenants) {
      const cfg = tenant.agentConfig as TenantAgentConfig | null;
      if (cfg?.whatsappPhoneNumberId === phoneNumberId) {
        const result: ResolvedWhatsAppTenant = {
          tenantId: tenant.id,
          credentials: {
            phoneNumberId: cfg.whatsappPhoneNumberId,
            accessToken: cfg.whatsappAccessToken ?? '',
            webhookSecret: cfg.whatsappWebhookSecret ?? '',
            appSecret: cfg.whatsappAppSecret ?? '',
          },
          agentConfig: cfg,
        };
        log.info('Resolved WhatsApp tenant from DB', {
          phoneNumberId,
          tenantId: tenant.id,
        });
        setCache(waCache, phoneNumberId, result);
        return result;
      }
    }
  } catch (err) {
    log.warn('Failed to query tenants for WhatsApp routing', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  }

  // ── Fallback: env-var credentials ──
  const envPhoneId = env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const envToken = env.WHATSAPP_ACCESS_TOKEN ?? '';

  if (envToken) {
    // Either this phone_number_id matches the env var, or there's no DB match
    // and we try the env credentials anyway (single-tenant / dev setup).
    const result: ResolvedWhatsAppTenant = {
      tenantId: env.DEFAULT_TENANT_ID ?? '',
      credentials: {
        phoneNumberId: envPhoneId || phoneNumberId,
        accessToken: envToken,
        webhookSecret: env.WHATSAPP_WEBHOOK_SECRET ?? '',
        appSecret: env.WHATSAPP_APP_SECRET ?? env.INSTAGRAM_APP_SECRET ?? '',
      },
      agentConfig: null, // will load from getPlatformConfig at runtime
    };

    if (envPhoneId && envPhoneId !== phoneNumberId) {
      log.warn('WhatsApp phone_number_id mismatch — using env credentials as fallback', {
        payloadPhoneId: phoneNumberId,
        envPhoneId,
      });
    }

    setCache(waCache, phoneNumberId, result);
    return result;
  }

  log.warn('No WhatsApp credentials found for phone_number_id', { phoneNumberId });
  setCache(waCache, phoneNumberId, null);
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract phone_number_id from a raw WhatsApp webhook payload.
 * Returns undefined if not found.
 */
export function extractPhoneNumberId(payload: unknown): string | undefined {
  try {
    const p = payload as Record<string, unknown>;
    const entries = (p?.entry as Array<Record<string, unknown>>) ?? [];
    for (const entry of entries) {
      const changes = (entry?.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        const value = change?.value as Record<string, unknown> | undefined;
        const metadata = value?.metadata as Record<string, unknown> | undefined;
        if (metadata?.phone_number_id) return String(metadata.phone_number_id);
      }
    }
  } catch { /* ignore */ }
  return undefined;
}

/** Clear the cache (for testing). */
export function clearTenantResolverCache(): void {
  waCache.clear();
}
