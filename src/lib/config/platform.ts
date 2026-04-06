/**
 * Platform configuration loader.
 *
 * Resolves platform-level settings (brand name, CORS, email sender, channel
 * credentials) from the tenant's agentConfig in the database, falling back
 * to environment variables for backwards compatibility.
 *
 * Usage:
 *   const cfg = await getPlatformConfig(tenantId);
 *   const sender = cfg.emailSenderAddress; // DB value or env fallback
 */

import { getTenantAgentConfig } from '@/lib/agents/tenant-config';
import { APP_NAME } from './constants';
import { env } from './env';
import { createLogger } from '@/lib/utils';

const log = createLogger('config:platform');

export interface PlatformConfig {
  /** Brand name for emails, WhatsApp, UI chrome. Falls back to APP_NAME. */
  platformName: string;

  /** Agent/assistant name for conversations. Falls back to APP_NAME. */
  agentName: string;

  /** Org display name. */
  orgName: string;

  /** CORS allowed origins (merged: DB + env). */
  allowedOrigins: Set<string>;

  /** CORS wildcard suffix (DB overrides env). */
  allowedOriginSuffix: string;

  /** Outbound email sender address. */
  emailSenderAddress: string;

  /** WhatsApp credentials (DB overrides env). */
  whatsapp: {
    phoneNumberId: string;
    accessToken: string;
    webhookSecret: string;
  };

  /** Instagram credentials (DB overrides env). */
  instagram: {
    pageAccessToken: string;
    appSecret: string;
    verifyToken: string;
  };
}

/**
 * Load platform config for a tenant, merging DB values with env fallbacks.
 *
 * @param tenantId - The tenant ID. If null/undefined, returns env-only defaults.
 */
export async function getPlatformConfig(
  tenantId?: string | null,
): Promise<PlatformConfig> {
  const tenantConfig = tenantId
    ? await getTenantAgentConfig(tenantId).catch((err) => {
        log.warn('Failed to load tenant config, using env defaults', {
          tenantId,
          error: err instanceof Error ? err.message : 'unknown',
        });
        return null;
      })
    : null;

  // ── Merge CORS origins: env + DB ──
  const envOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const dbOrigins = tenantConfig?.allowedOrigins
    ? tenantConfig.allowedOrigins
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const allowedOrigins = new Set([...envOrigins, ...dbOrigins]);

  return {
    platformName: tenantConfig?.platformName ?? APP_NAME,
    agentName: tenantConfig?.agentName ?? APP_NAME,
    orgName: tenantConfig?.orgName ?? APP_NAME,
    allowedOrigins,
    allowedOriginSuffix:
      tenantConfig?.allowedOriginSuffix ?? process.env.ALLOWED_ORIGIN_SUFFIX ?? '',
    emailSenderAddress:
      tenantConfig?.emailSenderAddress ?? env.SANDRA_EMAIL_ADDRESS ?? 'noreply@example.com',
    whatsapp: {
      phoneNumberId:
        tenantConfig?.whatsappPhoneNumberId ?? env.WHATSAPP_PHONE_NUMBER_ID ?? '',
      accessToken:
        tenantConfig?.whatsappAccessToken ?? env.WHATSAPP_ACCESS_TOKEN ?? '',
      webhookSecret:
        tenantConfig?.whatsappWebhookSecret ?? env.WHATSAPP_WEBHOOK_SECRET ?? '',
    },
    instagram: {
      pageAccessToken:
        tenantConfig?.instagramPageAccessToken ?? env.INSTAGRAM_PAGE_ACCESS_TOKEN ?? '',
      appSecret:
        tenantConfig?.instagramAppSecret ?? env.INSTAGRAM_APP_SECRET ?? '',
      verifyToken:
        tenantConfig?.instagramVerifyToken ?? env.INSTAGRAM_VERIFY_TOKEN ?? '',
    },
  };
}
