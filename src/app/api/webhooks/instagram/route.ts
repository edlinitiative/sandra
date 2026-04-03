import { NextResponse } from 'next/server';
import { getInstagramAdapter } from '@/lib/channels/instagram';
import { resolveChannelIdentity } from '@/lib/channels/channel-identity';
import { runSandraAgent } from '@/lib/agents';
import { ensureSessionContinuity, getOrCreateSessionForChannel } from '@/lib/memory/session-continuity';
import { resolveLanguage } from '@/lib/i18n';
import { getScopesForRole } from '@/lib/auth';
import { setCorrelationId, clearCorrelationId } from '@/lib/tools/resilience';
import { generateRequestId, createLogger } from '@/lib/utils';
import { splitForInstagram } from '@/lib/channels/instagram-formatter';
import { getWorkspaceIdentity, detectEmailClaim } from '@/lib/channels/identity-linker';
import {
  hasPendingVerification,
  verifyCode,
  startEmailVerification,
  extractVerificationCode,
} from '@/lib/channels/email-verification';
import { getUserMemoryStore } from '@/lib/memory/user-memory';

const log = createLogger('api:webhooks:instagram');

// ─── GET — Webhook verification (Meta challenge) ─────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode') ?? '';
  const token = searchParams.get('hub.verify_token') ?? '';
  const challenge = searchParams.get('hub.challenge') ?? '';

  const adapter = getInstagramAdapter();
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ status: 'ok' }, { status: 200 });
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

  // Await processing — errors are caught inside so we always reach the 200
  await processInboundAsync(rawBody, requestId);

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

// ─── Background processing ────────────────────────────────────────────────────

async function processInboundAsync(rawPayload: unknown, requestId: string): Promise<void> {
  try {
    const adapter = getInstagramAdapter();

    if (!adapter.isConfigured()) {
      log.warn('Instagram adapter not configured — skipping inbound message');
      return;
    }

    let inbound;
    try {
      inbound = await adapter.parseInbound(rawPayload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg.startsWith('SKIP:')) {
        log.info('Skipping non-message Instagram event', { reason: msg });
      } else {
        log.warn('Failed to parse Instagram inbound payload', { error: msg });
      }
      return;
    }

    const { channelUserId: psid, content, metadata } = inbound;
    const pageId = metadata?.pageId as string | undefined;

    // Fetch sender's profile (name + username) for personalised responses
    const profile = await adapter.fetchSenderProfile(psid);
    const senderName = profile.name;
    const igUsername = profile.username;

    log.info('Processing Instagram inbound DM', {
      from: `${psid.slice(0, 4)}****`,
      senderName: senderName ?? 'unknown',
      igUsername: igUsername ?? 'unknown',
      requestId,
    });

    // Show typing indicator immediately so the user knows Sandra is working
    void adapter.sendTypingIndicator(psid, pageId);

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
    const role = wsIdentity ? 'student' : 'guest';
    const scopes = getScopesForRole(role);

    // Resolve session
    const session = await getOrCreateSessionForChannel({
      channel: 'instagram',
      channelUserId: psid,
      userId,
    });

    const sessionId = session.sessionId;
    const language = resolveLanguage({ explicit: undefined, sessionLanguage: session.language });

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
      metadata: { requestId, source: 'instagram', psid, igUsername, workspaceEmail: wsIdentity?.email },
    });

    // Send reply — split into 1000-char chunks
    const chunks = splitForInstagram(result.response);
    for (const chunk of chunks) {
      await adapter.send({
        channelType: 'instagram',
        recipientId: psid,
        content: chunk,
        language: result.language,
        metadata: { pageId },
      });
    }

    log.info('Instagram reply sent', {
      from: `${psid.slice(0, 4)}****`,
      chunks: chunks.length,
      toolsUsed: result.toolsUsed,
    });
  } catch (error) {
    log.error('Instagram webhook processing error', {
      error: error instanceof Error ? error.message : 'unknown',
      requestId,
    });
  } finally {
    clearCorrelationId();
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
