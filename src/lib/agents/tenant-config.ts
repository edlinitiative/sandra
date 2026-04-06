/**
 * Per-tenant AI configuration.
 *
 * Stored as `agentConfig` (JSON) on the Tenant model.
 * Controls the AI assistant's identity, branding, knowledge context,
 * and tool access — so Sandra can be deployed for any organization
 * without EdLight-specific data leaking into their experience.
 */

import { db } from '@/lib/db';

// ── Type ─────────────────────────────────────────────────────────────────────

export interface TenantAgentConfig {
  /**
   * The AI assistant's name as shown to users.
   * Defaults to the platform's APP_NAME ("Sandra").
   */
  agentName?: string;

  /** The organization's display name — e.g. "EdLight", "Acme Corp". */
  orgName?: string;

  /**
   * A short description of what the organization does.
   * Injected into the identity block when no systemPromptOverride is set.
   */
  orgDescription?: string;

  /** Primary website URL — e.g. "edlight.org". */
  websiteUrl?: string;

  /** Primary contact email — e.g. "info@edlight.org". */
  contactEmail?: string;

  /**
   * Full override for the AI's identity/context section of the system prompt.
   *
   * When set, this replaces the default identity block entirely.
   * Do NOT include the current date — it is always appended automatically.
   *
   * Use this for organizations that need complete control over the persona,
   * tone, and domain knowledge injected at the top of every conversation.
   */
  systemPromptOverride?: string;

  /**
   * Additional content appended to the guidelines section.
   *
   * Use this for organization-specific tool routing rules, domain knowledge
   * hints, or behavioral notes that supplement the standard generic guidelines.
   *
   * Example: EdLight injects its course/program routing rules here so they
   * don't appear in the generic guidelines for other tenants.
   */
  additionalContext?: string;

  /**
   * Languages this tenant's users speak.
   * Defaults to all platform-supported languages.
   */
  supportedLanguages?: string[];

  /**
   * Tool access control list.
   * - `null` (default): all registered tools are available.
   * - `[]` (empty array): no tools (chat-only mode).
   * - `['toolName', ...]`: only the listed tools are available.
   */
  enabledTools?: string[] | null;

  /**
   * Topics this assistant is allowed to discuss.
   *
   * When set, Sandra will politely refuse requests that fall outside these
   * topics and redirect users to the org's contact channel instead.
   *
   * Use plain, human-readable phrases — they are injected directly into the
   * system prompt so the LLM can reason about scope.
   *
   * Example:
   *   ['EdLight programs and applications', 'EdLight courses and platforms',
   *    'account and enrollment questions', 'news and announcements']
   *
   * Leave `undefined` (default) to allow any topic (no restriction).
   */
  allowedTopics?: string[];

  /**
   * Custom message returned when a user asks about something outside the
   * allowed scope.
   *
   * If omitted, Sandra uses a sensible default that mentions the org name
   * and, when available, the org's website or contact email.
   *
   * Example:
   *   "I'm Sandra, EdLight's assistant. I can only help with EdLight programs,
   *    courses, and account questions. For anything else, visit edlight.org."
   */
  offTopicResponse?: string;

  // ── Platform & Deployment ──────────────────────────────────────────────────

  /**
   * Platform/brand name shown in emails, WhatsApp mentions, layout title, etc.
   * Defaults to APP_NAME from constants ('Sandra').
   * This is the "public-facing" brand name — separate from agentName which is
   * the AI assistant's persona name used in conversations.
   */
  platformName?: string;

  /**
   * Comma-separated list of allowed CORS origins.
   * Merged with the ALLOWED_ORIGINS env var at runtime.
   * Example: "https://app.acme.com,https://staging.acme.com"
   */
  allowedOrigins?: string;

  /**
   * Wildcard suffix for CORS origin matching.
   * Merged with ALLOWED_ORIGIN_SUFFIX env var.
   * Example: ".acme.com" allows all *.acme.com subdomains.
   */
  allowedOriginSuffix?: string;

  /**
   * The email address used as the "from" sender for outbound emails
   * (verification codes, notifications, etc.).
   * Falls back to SANDRA_EMAIL_ADDRESS env var → 'noreply@example.com'.
   */
  emailSenderAddress?: string;

  // ── Channel Credentials ────────────────────────────────────────────────────

  /**
   * WhatsApp Cloud API credentials.
   * Falls back to WHATSAPP_* env vars when not set.
   */
  whatsappPhoneNumberId?: string;
  whatsappAccessToken?: string;
  whatsappWebhookSecret?: string;

  /**
   * Instagram Graph API credentials.
   * Falls back to INSTAGRAM_* env vars when not set.
   */
  instagramPageAccessToken?: string;
  instagramAppSecret?: string;
  instagramVerifyToken?: string;
}

// ── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load the TenantAgentConfig for a given tenant ID.
 * Returns null if the tenant has no agentConfig set (caller should use fallback).
 */
export async function getTenantAgentConfig(
  tenantId: string,
): Promise<TenantAgentConfig | null> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { agentConfig: true },
  });

  if (!tenant?.agentConfig) return null;
  return tenant.agentConfig as TenantAgentConfig;
}
