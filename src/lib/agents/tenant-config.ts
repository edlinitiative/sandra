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
