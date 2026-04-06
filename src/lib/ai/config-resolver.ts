/**
 * AI Provider Config Resolver.
 *
 * Loads AI provider API keys and configuration from the database
 * (ConnectedProvider), falling back to environment variables when
 * no DB entry exists.  This lets admins update keys from the website
 * without touching Vercel env vars.
 *
 * Storage: ConnectedProvider rows with provider = 'ai_openai' | 'ai_gemini' | 'ai_anthropic'
 *   credentials: { apiKey: string }
 *   config:      { model?: string, priority?: number }
 */

import { db } from '@/lib/db';
import { env } from '@/lib/config';
import { createLogger } from '@/lib/utils';
import { Prisma } from '@prisma/client';
import type { ProviderType } from '@prisma/client';

const log = createLogger('ai:config-resolver');

// ── Types ────────────────────────────────────────────────────────────────────

export interface AIProviderKeyConfig {
  apiKey: string;
  model?: string;
}

export interface ResolvedAIConfig {
  openai?: AIProviderKeyConfig;
  gemini?: AIProviderKeyConfig;
  anthropic?: AIProviderKeyConfig;
  /** Comma-separated priority order, e.g. 'openai,gemini,anthropic' */
  priority: string;
}

/** What we store in ConnectedProvider.credentials for AI providers */
export interface AIProviderCredentials {
  apiKey: string;
}

/** What we store in ConnectedProvider.config for AI providers */
export interface AIProviderProviderConfig {
  model?: string;
  ttsModel?: string; // Gemini only
}

// ── Map between our provider names and the Prisma enum ─────────────────────

const PROVIDER_MAP: Record<string, ProviderType> = {
  openai: 'ai_openai',
  gemini: 'ai_gemini',
  anthropic: 'ai_anthropic',
};

const REVERSE_MAP: Record<string, string> = {
  ai_openai: 'openai',
  ai_gemini: 'gemini',
  ai_anthropic: 'anthropic',
};

// ── Cache ────────────────────────────────────────────────────────────────────
// Caches resolved config for 60 seconds to avoid a DB query on every chat call.

let _cache: { config: ResolvedAIConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

/** Flush the cached config (call after an admin saves new keys). */
export function invalidateAIConfigCache(): void {
  _cache = null;
}

// ── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolve AI provider configuration for a tenant.
 *
 * Reads ConnectedProvider rows of type ai_openai / ai_gemini / ai_anthropic
 * for the given tenant.  Falls back to env vars for any provider not
 * configured in the DB.
 *
 * @param tenantId  If provided, reads from DB.  If null/undefined, uses env vars only.
 */
export async function resolveAIConfig(tenantId?: string | null): Promise<ResolvedAIConfig> {
  // Fast-path: use cache if still valid
  if (_cache && Date.now() < _cache.expiresAt) {
    return _cache.config;
  }

  const config: ResolvedAIConfig = {
    priority: env.AI_PROVIDER_PRIORITY ?? 'openai,gemini,anthropic',
  };

  // ── DB lookup ──
  if (tenantId) {
    try {
      const rows = await db.connectedProvider.findMany({
        where: {
          tenantId,
          provider: { in: ['ai_openai', 'ai_gemini', 'ai_anthropic'] },
          isActive: true,
        },
      });

      for (const row of rows) {
        const name = REVERSE_MAP[row.provider];
        if (!name) continue;

        const creds = row.credentials as unknown as AIProviderCredentials;
        const provConfig = (row.config ?? {}) as unknown as AIProviderProviderConfig;

        if (creds.apiKey && creds.apiKey.length >= 10) {
          const keyConfig: AIProviderKeyConfig = {
            apiKey: creds.apiKey,
            model: provConfig.model,
          };
          if (name === 'openai') config.openai = keyConfig;
          else if (name === 'gemini') config.gemini = keyConfig;
          else if (name === 'anthropic') config.anthropic = keyConfig;
          log.debug(`Loaded ${name} key from DB`, { tenantId, providerId: row.id });
        }
      }
    } catch (err) {
      log.warn('Failed to load AI config from DB — falling back to env vars', {
        tenantId,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // ── Env var fallback for anything not loaded from DB ──
  if (!config.openai) {
    const key = env.OPENAI_API_KEY;
    if (key && key.length >= 10 && !key.startsWith('sk-your') && key !== 'change-me') {
      config.openai = { apiKey: key, model: env.OPENAI_MODEL };
    }
  }

  if (!config.gemini) {
    const key = env.GEMINI_API_KEY;
    if (key && key.length >= 10) {
      config.gemini = { apiKey: key, model: env.GEMINI_MODEL };
    }
  }

  if (!config.anthropic) {
    const key = env.ANTHROPIC_API_KEY;
    if (key && key.length >= 10) {
      config.anthropic = { apiKey: key, model: env.ANTHROPIC_MODEL };
    }
  }

  // ── Cache ──
  _cache = { config, expiresAt: Date.now() + CACHE_TTL_MS };

  return config;
}

// ── Masking helper ───────────────────────────────────────────────────────────

/** Mask an API key for display: 'sk-abc...xyz' → 'sk-abc...xyz' (first 6, last 4) */
export function maskApiKey(key: string): string {
  if (key.length <= 12) return '••••••••';
  return `${key.slice(0, 7)}${'•'.repeat(8)}${key.slice(-4)}`;
}

// ── Save helper ──────────────────────────────────────────────────────────────

/**
 * Upsert an AI provider's credentials + config in the DB for a tenant.
 * Pass `null` for apiKey to remove (deactivate) the provider.
 */
export async function saveAIProviderKey(
  tenantId: string,
  providerName: 'openai' | 'gemini' | 'anthropic',
  apiKey: string | null,
  model?: string,
): Promise<void> {
  const providerType = PROVIDER_MAP[providerName];
  if (!providerType) throw new Error(`Unknown AI provider: ${providerName}`);

  if (apiKey === null || apiKey.trim() === '') {
    // Deactivate
    await db.connectedProvider.updateMany({
      where: { tenantId, provider: providerType },
      data: { isActive: false },
    });
    log.info(`Deactivated AI provider ${providerName}`, { tenantId });
  } else {
    const credentials: AIProviderCredentials = { apiKey: apiKey.trim() };
    const config: AIProviderProviderConfig = {};
    if (model) config.model = model;

    await db.connectedProvider.upsert({
      where: { tenantId_provider: { tenantId, provider: providerType } },
      create: {
        tenantId,
        provider: providerType,
        label: `AI — ${providerName.charAt(0).toUpperCase() + providerName.slice(1)}`,
        credentials: credentials as unknown as Prisma.InputJsonValue,
        config: config as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
      update: {
        credentials: credentials as unknown as Prisma.InputJsonValue,
        config: config as unknown as Prisma.InputJsonValue,
        isActive: true,
        lastHealthCheck: null,
        lastHealthStatus: null,
      },
    });
    log.info(`Saved AI provider ${providerName} key`, { tenantId });
  }

  // Invalidate caches so the next request picks up new keys
  invalidateAIConfigCache();
}

/**
 * Save the AI provider priority order for a tenant.
 * Stored in the tenant's agentConfig JSON.
 */
export async function saveAIProviderPriority(
  tenantId: string,
  priority: string,
): Promise<void> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { agentConfig: true },
  });

  const existing = (tenant?.agentConfig ?? {}) as Record<string, unknown>;
  existing.aiProviderPriority = priority;

  await db.tenant.update({
    where: { id: tenantId },
    data: { agentConfig: existing as Prisma.InputJsonValue },
  });

  invalidateAIConfigCache();
  log.info('Saved AI provider priority', { tenantId, priority });
}
