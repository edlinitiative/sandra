import { NextResponse } from 'next/server';
import { getInstagramAdapter, createInstagramAdapter } from '@/lib/channels/instagram';
import { resolveChannelIdentity } from '@/lib/channels/channel-identity';
import { runSandraAgent } from '@/lib/agents';
import { ensureSessionContinuity, getOrCreateSessionForChannel } from '@/lib/memory/session-continuity';
import { resolveLanguage, detectMessageLanguage } from '@/lib/i18n';
import { getScopesForRole } from '@/lib/auth';
import { setCorrelationId, clearCorrelationId } from '@/lib/tools/resilience';
import { generateRequestId, createLogger, verifyMetaSignature, isDuplicate } from '@/lib/utils';
import { getWorkspaceIdentity, detectEmailClaim } from '@/lib/channels/identity-linker';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { getPlatformConfig } from '@/lib/config/platform';
import {
  hasPendingVerification,
  verifyCode,
  startEmailVerification,
  extractVerificationCode,
} from '@/lib/channels/email-verification';
import { getUserMemoryStore } from '@/lib/memory/user-memory';
import { getRequestIp, logWebhookEvent } from '@/lib/webhooks/logger';

const log = createLogger('api:webhooks:instagram');

/**
 * PSIDs currently being processed.
 * Prevents a second inbound message from the same user spawning a parallel
 * agent run while an earlier one is still in-flight.
 */
const activeProcessing = new Set<string>();

/** Re-fire typing_on every N ms so Meta doesn't hide the indicator. */
const TYPING_REFRESH_MS = 12_000;

// ─── Adapter construction (DB → env credential merge) ─────────────────────────

/**
 * Build an Instagram adapter from a fully-resolved PlatformConfig.
 * This pulls credentials from the tenant's agentConfig (admin UI) first,
 * falling back to env vars — mirroring the WhatsApp tenant-routing pattern
 * introduced in commit 944f730.
 *
 * Trims values defensively to defend against trailing newlines that crept in
 * from Vercel env-var pasting (the same root cause as the WhatsApp 403
 * outage). Returns the env-only singleton if nothing is configured at all,
 * so isConfigured() can flag the misconfiguration cleanly.
 */
function buildInstagramAdapterFromConfig(
  platformConfig: Awaited<ReturnType<typeof getPlatformConfig>>,
) {
  const pageAccessToken = (platformConfig.instagram.pageAccessToken ?? '').trim();
  const verifyToken = (platformConfig.instagram.verifyToken ?? '').trim();

  if (pageAccessToken && verifyToken) {
    return createInstagramAdapter({ pageAccessToken, verifyToken });
  }
  return getInstagramAdapter();
}

/** Convenience used by GET (subscribe handshake). */
async function getInstagramAdapterForTenant() {
  const platformConfig = await getPlatformConfig(env.DEFAULT_TENANT_ID);
  return buildInstagramAdapterFromConfig(platformConfig);
}

// ─── GET — Webhook verification (Meta challenge) ─────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode') ?? '';
  const token = searchParams.get('hub.verify_token') ?? '';
  const challenge = searchParams.get('hub.challenge') ?? '';

  // Build adapter from merged DB+env credentials so admins can configure
  // Instagram entirely from the UI without setting env vars.
  const adapter = await getInstagramAdapterForTenant();
  const verified = adapter.verifyWebhook({ mode, token, challenge });

  if (verified !== null) {
    return new Response(verified, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  log.warn('Instagram webhook verification rejected');
  return new Response('Forbidden', { status: 403 });
}

// ─── POST — Inbound DM handler ────────────────────────────────────────────────

export async function POST(request: Request) {
  const requestId = generateRequestId();
  setCorrelationId(requestId);
  const requestIp = getRequestIp(request);

  let rawText: string;
  let rawBody: unknown;
  try {
    rawText = await request.text();
    rawBody = JSON.parse(rawText);
  } catch {
    await logWebhookEvent({
      channel: 'instagram',
      action: 'webhook_failed',
      requestId,
      ip: requestIp,
      details: { stage: 'decode', reason: 'invalid_json_body' },
    });
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  await logWebhookEvent({
    channel: 'instagram',
    action: 'webhook_received',
    requestId,
    ip: requestIp,
    details: { messageId: extractInstagramMessageId(rawBody) ?? null },
  });

  // ── Signature verification (Meta HMAC-SHA256) ─────────────────────────
  const platformConfig = await getPlatformConfig(env.DEFAULT_TENANT_ID);
  // Meta may deliver webhooks from an app different than the one currently
  // used for outbound sends in this tenant. Accept any configured Meta app
  // secret for this project and require that at least one matches.
  const signature = request.headers.get('x-hub-signature-256');
  const candidateSecrets = [
    platformConfig.instagram.appSecret,
    env.INSTAGRAM_APP_SECRET,
    env.WHATSAPP_APP_SECRET,
    process.env.EDLIGHT_NEWS_APP_SECRET,
    process.env.EDLIGHT_NEWS_APP_SECRET_2,
    process.env.SANDRA_APP_SECRET,
    process.env.SANDRA_INSTAGRAM_APP_SECRET,
  ]
    .map((value) => (value ?? '').trim())
    .filter(Boolean);

  const uniqueSecrets = [...new Set(candidateSecrets)];
  if (uniqueSecrets.length > 0) {
    const matchedSecret = uniqueSecrets.find((secret) =>
      verifyMetaSignature(rawText, signature, secret),
    );

    if (!matchedSecret) {
      await logWebhookEvent({
        channel: 'instagram',
        action: 'webhook_rejected',
        requestId,
        ip: requestIp,
        details: { stage: 'signature', reason: 'invalid_signature' },
      });
      log.warn('Instagram webhook signature verification failed', {
        requestId,
        checkedSecrets: uniqueSecrets.length,
      });
      return new Response('Forbidden', { status: 403 });
    }

    log.info('Instagram webhook signature verified', {
      requestId,
      secretPrefix: matchedSecret.slice(0, 8),
    });
  }

  // Log the raw payload for debugging
  log.info('Instagram webhook received', {
    requestId,
    object: (rawBody as Record<string, unknown>)?.object,
    entryCount: Array.isArray((rawBody as Record<string, unknown>)?.entry)
      ? ((rawBody as Record<string, unknown>).entry as unknown[]).length
      : 0,
    payload: JSON.stringify(rawBody).slice(0, 500),
  });

  // ── Message deduplication ──────────────────────────────────────────────
  const messageId = extractInstagramMessageId(rawBody);
  if (isDuplicate(messageId)) {
    await logWebhookEvent({
      channel: 'instagram',
      action: 'webhook_skipped',
      requestId,
      ip: requestIp,
      details: { stage: 'dedup', messageId: messageId ?? null, reason: 'duplicate' },
    });
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // Build the adapter from DB+env credentials (parity with WhatsApp routing).
  const adapter = buildInstagramAdapterFromConfig(platformConfig);

  // Await processing — errors are caught inside so we always reach the 200
  await processInboundAsync(rawBody, requestId, adapter, requestIp);

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

// ─── Background processing ────────────────────────────────────────────────────

async function processInboundAsync(
  rawPayload: unknown,
  requestId: string,
  adapter: ReturnType<typeof getInstagramAdapter>,
  requestIp?: string,
): Promise<void> {
  try {
    if (!adapter.isConfigured()) {
      await logWebhookEvent({
        channel: 'instagram',
        action: 'webhook_skipped',
        requestId,
        ip: requestIp,
        details: { stage: 'config', reason: 'adapter_not_configured' },
      });
      log.warn('Instagram adapter not configured — skipping inbound message', {
        requestId,
        hint: 'Set INSTAGRAM_PAGE_ACCESS_TOKEN + INSTAGRAM_VERIFY_TOKEN (or BUSINESS_META_TOKEN), or configure them via the admin Platform Settings page.',
      });
      return;
    }

    let inbound;
    try {
      inbound = await adapter.parseInbound(rawPayload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg.startsWith('SKIP:')) {
        await logWebhookEvent({
          channel: 'instagram',
          action: 'webhook_skipped',
          requestId,
          ip: requestIp,
          details: { stage: 'parse', reason: msg },
        });
        log.info('Skipping non-message Instagram event', { reason: msg });
      } else {
        await logWebhookEvent({
          channel: 'instagram',
          action: 'webhook_failed',
          requestId,
          ip: requestIp,
          details: { stage: 'parse', reason: msg },
        });
        log.warn('Failed to parse Instagram inbound payload', { error: msg });
      }
      return;
    }

    const { channelUserId: psid, content, metadata } = inbound;
    const pageId = metadata?.pageId as string | undefined;

    // ── Per-PSID concurrency guard ────────────────────────────────────────
    // Drop the second message if the same user's first is still processing.
    // This prevents two parallel agent runs racing each other with no context.
    if (activeProcessing.has(psid)) {
      log.info('Instagram: message dropped — prior message still processing', {
        psid: `${psid.slice(0, 4)}****`,
      });
      return;
    }
    activeProcessing.add(psid);

    try {
      await _processMessage({ adapter, psid, pageId, content, inbound, requestId, requestIp });
    } finally {
      activeProcessing.delete(psid);
    }
  } catch (error) {
    await logWebhookEvent({
      channel: 'instagram',
      action: 'webhook_failed',
      requestId,
      ip: requestIp,
      details: { stage: 'process', reason: error instanceof Error ? error.message : 'unknown' },
    });
    log.error('Instagram webhook processing error', {
      error: error instanceof Error ? error.message : 'unknown',
      requestId,
    });
  } finally {
    clearCorrelationId();
  }
}

// ─── Inner message processor (runs inside the concurrency guard) ──────────────

async function _processMessage(ctx: {
  adapter: ReturnType<typeof getInstagramAdapter>;
  psid: string;
  pageId: string | undefined;
  content: string;
  inbound: Awaited<ReturnType<ReturnType<typeof getInstagramAdapter>['parseInbound']>>;
  requestId: string;
  requestIp?: string;
}): Promise<void> {
  const { adapter, psid, pageId, content, inbound, requestId, requestIp } = ctx;

  // Fetch sender's profile (name + username) for personalised responses
  const profile = await adapter.fetchSenderProfile(psid, pageId);
  const senderName = profile.name;
  const igUsername = profile.username;

  log.info('Processing Instagram inbound DM', {
    from: `${psid.slice(0, 4)}****`,
    senderName: senderName ?? 'unknown',
    igUsername: igUsername ?? 'unknown',
    requestId,
  });

  // ── Typing indicator — fire immediately, refresh every 12 s ──────────
  // Meta's typing_on expires after ~20 s; long tool-call chains can take
  // 30-60 s, leaving users staring at an empty screen. The interval keeps
  // the indicator alive for the full agent run duration.
  void adapter.sendTypingIndicator(psid, pageId);
  const typingInterval = setInterval(() => {
    void adapter.sendTypingIndicator(psid, pageId);
  }, TYPING_REFRESH_MS);

  try {
    // Resolve or create channel identity → Sandra user
    const identity = await resolveChannelIdentity({
      channel: 'instagram',
      externalId: psid,
      displayName: senderName ?? igUsername ?? undefined,
      metadata: { requestId, igUsername },
    });

    const userId = identity.userId;

    // Save Instagram username to user memory (best-effort)
    if (igUsername) {
      void saveInstagramUsername(userId, igUsername);
    }

    // Check if this IG user is already linked to a Workspace identity
    const wsIdentity = await getWorkspaceIdentity(userId).catch(() => null);
    let resolvedName = wsIdentity?.name ?? senderName ?? igUsername ?? undefined;

    if (wsIdentity) {
      log.info('Workspace identity linked (Instagram)', { userId, email: wsIdentity.email });
    }

    // ── EMAIL VERIFICATION INTERCEPTORS ──────────────────────────────────

    // 1. If user has a pending verification, check if this message is a code
    const pendingVerification = await hasPendingVerification(userId);
    if (pendingVerification) {
      const codeCandidate = extractVerificationCode(content);
      if (codeCandidate) {
        const result = await verifyCode(userId, codeCandidate);
        if (result.success) {
          resolvedName = result.name ?? resolvedName;
          await adapter.send({
            channelType: 'instagram',
            recipientId: psid,
            content: `✅ Verified! You're linked as ${result.name} (${result.email}). I'll remember you from now on.`,
            language: 'en',
            metadata: { pageId },
          });
        } else {
          await adapter.send({
            channelType: 'instagram',
            recipientId: psid,
            content: result.error ?? 'Verification failed.',
            language: 'en',
            metadata: { pageId },
          });
        }
        return; // Don't process further — this was a verification interaction
      }
      // Not a code — fall through to normal processing
    }

    // 2. Check if message contains an email claim → start verification flow
    if (!wsIdentity) {
      const claimedEmail = detectEmailClaim(content);
      if (claimedEmail) {
        log.info('Email claim detected on Instagram, starting verification', { userId, claimedEmail });
        const result = await startEmailVerification(userId, claimedEmail, 'instagram');
        if (result.success) {
          await adapter.send({
            channelType: 'instagram',
            recipientId: psid,
            content: `I sent a verification code to ${result.maskedEmail}. Reply with the 6-digit code to link your account.`,
            language: 'en',
            metadata: { pageId },
          });
        } else {
          await adapter.send({
            channelType: 'instagram',
            recipientId: psid,
            content: result.error ?? 'Could not start verification.',
            language: 'en',
            metadata: { pageId },
          });
        }
        return; // Don't process further
      }
    }

    // ── RESOLVE ROLE FOR LINKED USERS ────────────────────────────────────
    // NOTE: Instagram users are separate DB Users from their web-app counterpart.
    // wsIdentity.email IS the bridge — the web-app User has email=wsIdentity.email
    // and that User's TenantMember holds the real role (admin/manager/basic).
    // Querying by the channel userId would find nothing; query via user.email instead.
    let role: 'guest' | 'student' | 'educator' | 'admin' = wsIdentity ? 'student' : 'guest';
    if (wsIdentity) {
      const membership = await db.tenantMember.findFirst({
        where: { user: { email: wsIdentity.email }, isActive: true },
        select: { role: true },
      });
      if (membership?.role === 'admin') role = 'admin';
      else if (membership?.role === 'manager') role = 'educator';
    }
    const scopes = getScopesForRole(role);

    // Resolve session
    const session = await getOrCreateSessionForChannel({
      channel: 'instagram',
      channelUserId: psid,
      userId,
    });

    const sessionId = session.sessionId;

    // ── Language resolution ───────────────────────────────────────────────
    // For new sessions (no stored language), detect from the incoming message
    // content. This ensures French/Haitian Creole users get a response in their
    // language from the very first turn, not after an awkward English exchange.
    const detectedLang = !session.language
      ? detectMessageLanguage(content)
      : undefined;
    const language = resolveLanguage({ explicit: detectedLang, sessionLanguage: session.language });

    await ensureSessionContinuity({ sessionId, channel: 'instagram', language, userId });

    const result = await runSandraAgent({
      message: content,
      sessionId,
      userId,
      language,
      channel: 'instagram',
      senderName: resolvedName,
      attachments: inbound.attachments,
      scopes,
      workspaceEmail: wsIdentity?.email,
      metadata: { requestId, source: 'instagram', psid, igUsername, workspaceEmail: wsIdentity?.email },
    });

    // adapter.send() handles format → split → multi-chunk delivery internally.
    // No need to split here — just pass the full response.
    await adapter.send({
      channelType: 'instagram',
      recipientId: psid,
      content: result.response,
      language: result.language,
      metadata: { pageId },
    });

    log.info('Instagram reply sent', {
      from: `${psid.slice(0, 4)}****`,
      toolsUsed: result.toolsUsed,
      detectedLang: detectedLang ?? null,
      language,
    });

    await logWebhookEvent({
      channel: 'instagram',
      action: 'webhook_processed',
      requestId,
      ip: requestIp,
      sessionId,
      userId,
      details: {
        pageId: pageId ?? null,
        psid,
        toolsUsed: result.toolsUsed,
        language: result.language,
      },
    });
  } finally {
    clearInterval(typingInterval);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IG_USERNAME_KEY = 'instagram_username';

/**
 * Save the Instagram username to user memory for future reference.
 */
async function saveInstagramUsername(userId: string, username: string): Promise<void> {
  try {
    const store = getUserMemoryStore();
    await store.saveMemory(userId, {
      key: IG_USERNAME_KEY,
      value: username,
      source: 'instagram_profile',
      confidence: 1.0,
      updatedAt: new Date(),
    });
  } catch {
    // best-effort — don't break the flow
  }
}

/** Extract the Instagram message ID (mid) from the raw webhook payload for dedup. */
function extractInstagramMessageId(payload: unknown): string | undefined {
  try {
    const p = payload as Record<string, unknown>;
    const entries = (p?.entry as Array<Record<string, unknown>>) ?? [];
    for (const entry of entries) {
      const messaging = (entry?.messaging as Array<Record<string, unknown>>) ?? [];
      for (const msg of messaging) {
        const message = msg?.message as Record<string, unknown> | undefined;
        if (message?.mid) return message.mid as string;
        const postback = msg?.postback as Record<string, unknown> | undefined;
        if (postback?.mid) return postback.mid as string;
      }
    }
  } catch { /* ignore — no ID available */ }
  return undefined;
}
