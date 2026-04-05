import { NextResponse } from 'next/server';
import { getWhatsAppAdapter } from '@/lib/channels/whatsapp';
import { resolveChannelIdentity } from '@/lib/channels/channel-identity';
import { runSandraAgent } from '@/lib/agents';
import { ensureSessionContinuity, getOrCreateSessionForChannel } from '@/lib/memory/session-continuity';
import { resolveLanguage } from '@/lib/i18n';
import { getScopesForRole } from '@/lib/auth';
import { setCorrelationId, clearCorrelationId } from '@/lib/tools/resilience';
import { generateRequestId, createLogger, verifyMetaSignature, isDuplicate } from '@/lib/utils';
import { splitForWhatsApp } from '@/lib/channels/whatsapp-formatter';
import { isSandraMentioned, stripMention, buildGroupSessionId, formatGroupContext, isReplyToSandra } from '@/lib/channels/whatsapp-group';
import { storeGroupMessage, getGroupSharingNote } from '@/lib/channels/group-privacy';
import { tryAutoLink, getWorkspaceIdentity, detectEmailClaim } from '@/lib/channels/identity-linker';
import { db } from '@/lib/db';
import {
  hasPendingVerification,
  verifyCode,
  startEmailVerification,
  extractVerificationCode,
} from '@/lib/channels/email-verification';

const log = createLogger('api:webhooks:whatsapp');

// ─── GET — Webhook verification (Meta challenge) ─────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode') ?? '';
  const token = searchParams.get('hub.verify_token') ?? '';
  const challenge = searchParams.get('hub.challenge') ?? '';

  const adapter = getWhatsAppAdapter();
  const verified = adapter.verifyWebhook({ mode, token, challenge });

  if (verified !== null) {
    return new Response(verified, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  log.warn('WhatsApp webhook verification rejected');
  return new Response('Forbidden', { status: 403 });
}

// ─── POST — Inbound message handler ──────────────────────────────────────────

export async function POST(request: Request) {
  // Always respond 200 quickly — Meta requires < 5s
  const requestId = generateRequestId();
  setCorrelationId(requestId);

  let rawText: string;
  let rawBody: unknown;
  try {
    rawText = await request.text();
    rawBody = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // ── Signature verification (Meta HMAC-SHA256) ─────────────────────────
  const appSecret = process.env.WHATSAPP_WEBHOOK_SECRET ?? '';
  if (appSecret) {
    const signature = request.headers.get('x-hub-signature-256');
    if (!verifyMetaSignature(rawText, signature, appSecret)) {
      log.warn('WhatsApp webhook signature verification failed', { requestId });
      return new Response('Forbidden', { status: 403 });
    }
  }

  // ── Calls webhook — proxy to voice bridge ───────────────────────────────
  // The voice bridge runs on a separate VM and handles WhatsApp Calling API
  // events. We forward the payload and respond 200 immediately regardless.
  if (isCallsWebhookEvent(rawBody)) {
    const voiceBridgeUrl = process.env.VOICE_BRIDGE_URL ?? 'https://voice.edlight.org';
    void fetch(`${voiceBridgeUrl}/webhook/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawBody),
    }).catch((err) => {
      log.warn('Failed to forward calls webhook to voice bridge', { error: String(err) });
    });
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // ── Message deduplication ──────────────────────────────────────────────
  const messageId = extractWhatsAppMessageId(rawBody);
  if (isDuplicate(messageId)) {
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // Await processing — errors are caught inside so we always reach the 200
  await processWebhookAsync(rawBody, requestId);

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isCallsWebhookEvent(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  try {
    const entries = (p?.entry as Array<Record<string, unknown>>) ?? [];
    return entries.some((entry) => {
      const changes = (entry?.changes as Array<Record<string, unknown>>) ?? [];
      return changes.some((c) => c?.field === 'calls');
    });
  } catch {
    return false;
  }
}

/** Extract the WhatsApp message ID from the raw webhook payload for dedup. */
function extractWhatsAppMessageId(payload: unknown): string | undefined {
  try {
    const p = payload as Record<string, unknown>;
    const entries = (p?.entry as Array<Record<string, unknown>>) ?? [];
    for (const entry of entries) {
      const changes = (entry?.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        const value = change?.value as Record<string, unknown> | undefined;
        const messages = (value?.messages as Array<Record<string, unknown>>) ?? [];
        if (messages[0]?.id) return messages[0].id as string;
      }
    }
  } catch { /* ignore — no ID available */ }
  return undefined;
}

// ─── Background processing ────────────────────────────────────────────────────

async function processWebhookAsync(rawPayload: unknown, requestId: string): Promise<void> {
  try {
    const adapter = getWhatsAppAdapter();

    if (!adapter.isConfigured()) {
      log.warn('WhatsApp adapter not configured — skipping inbound message');
      return;
    }

    // Parse inbound message
    let inbound;
    try {
      inbound = await adapter.parseInbound(rawPayload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg.startsWith('SKIP:')) {
        log.info('Skipping non-message webhook event', { reason: msg });
      } else {
        log.warn('Failed to parse WhatsApp inbound payload', { error: msg });
      }
      return;
    }

    const { channelUserId: phoneNumber, content, metadata } = inbound;
    const whatsappMessageId = metadata?.whatsappMessageId as string | undefined;
    const displayName = metadata?.displayName as string | null | undefined;
    const isGroup = inbound.isGroup ?? false;
    const groupId = inbound.groupId;

    log.info('Processing WhatsApp inbound message', {
      from: `${phoneNumber.slice(0, 4)}****`,
      isGroup,
      groupId: groupId ? `${groupId.slice(0, 8)}...` : undefined,
      requestId,
    });

    // Mark message as read (best-effort)
    if (whatsappMessageId) {
      void adapter.markAsRead(whatsappMessageId);
    }

    // ── GROUP CHAT FLOW ───────────────────────────────────────────────────
    if (isGroup && groupId) {
      return processGroupMessage({
        adapter,
        inbound,
        phoneNumber,
        content,
        displayName: displayName ?? undefined,
        groupId,
        requestId,
      });
    }

    // ── 1:1 DM FLOW (existing) ───────────────────────────────────────────
    void adapter.sendTypingIndicator(phoneNumber);

    // Resolve or create channel identity → Sandra user (auto-creates if new phone)
    const identity = await resolveChannelIdentity({
      channel: 'whatsapp',
      externalId: phoneNumber,
      displayName: displayName ?? undefined,
      metadata: { requestId },
    });

    const userId = identity.userId;

    // Try to auto-link WhatsApp user to their Workspace identity (best-effort)
    const wsIdentity = await tryAutoLink(userId, phoneNumber).catch(() => null);
    let resolvedName = wsIdentity?.name ?? displayName ?? undefined;
    if (wsIdentity) {
      log.info('Workspace identity linked', { userId, email: wsIdentity.email });
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
            channelType: 'whatsapp',
            recipientId: phoneNumber,
            content: `✅ Verified! You're linked as *${result.name}* (${result.email}). I'll remember you from now on.`,
            language: 'en',
          });
        } else {
          await adapter.send({
            channelType: 'whatsapp',
            recipientId: phoneNumber,
            content: result.error ?? 'Verification failed.',
            language: 'en',
          });
        }
        return; // Don't process further — this was a verification interaction
      }
      // Not a code — fall through to normal processing (they might be chatting normally)
    }

    // 2. Check if message contains an email claim → start verification flow
    if (!wsIdentity) {
      const claimedEmail = detectEmailClaim(content);
      if (claimedEmail) {
        log.info('Email claim detected, starting verification', { userId, claimedEmail });
        const result = await startEmailVerification(userId, claimedEmail);
        if (result.success) {
          await adapter.send({
            channelType: 'whatsapp',
            recipientId: phoneNumber,
            content: `I sent a verification code to *${result.maskedEmail}*. Reply with the 6-digit code to link your account.`,
            language: 'en',
          });
        } else {
          await adapter.send({
            channelType: 'whatsapp',
            recipientId: phoneNumber,
            content: result.error ?? 'Could not start verification.',
            language: 'en',
          });
        }
        return; // Don't process further
      }
    }

    // ── RESOLVE ROLE FOR LINKED USERS ────────────────────────────────────
    // Look up the user's actual TenantMember role so admins get gmail:send etc.
    // NOTE: WhatsApp users are separate DB Users from their web-app counterpart.
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

    // Resolve session for this channel user
    const session = await getOrCreateSessionForChannel({
      channel: 'whatsapp',
      channelUserId: phoneNumber,
      userId,
    });

    const sessionId = session.sessionId;

    // Detect language (default to English; session language overrides)
    const language = resolveLanguage({ explicit: undefined, sessionLanguage: session.language });

    await ensureSessionContinuity({
      sessionId,
      channel: 'whatsapp',
      language,
      userId,
    });

    // Run Sandra agent
    const result = await runSandraAgent({
      message: content,
      sessionId,
      userId,
      language,
      channel: 'whatsapp',
      senderName: resolvedName,
      attachments: inbound.attachments,
      scopes,
      workspaceEmail: wsIdentity?.email,
      metadata: { requestId, source: 'whatsapp', phoneNumber, workspaceEmail: wsIdentity?.email },
    });

    // Send reply — split into chunks if needed
    const chunks = splitForWhatsApp(result.response);
    for (const chunk of chunks) {
      await adapter.send({
        channelType: 'whatsapp',
        recipientId: phoneNumber,
        content: chunk,
        language: result.language,
      });
    }

    log.info('WhatsApp reply sent', {
      from: `${phoneNumber.slice(0, 4)}****`,
      chunks: chunks.length,
      toolsUsed: result.toolsUsed,
    });
  } catch (error) {
    log.error('WhatsApp webhook processing error', {
      error: error instanceof Error ? error.message : 'unknown',
      requestId,
    });
  } finally {
    clearCorrelationId();
  }
}

// ─── Group message handler ────────────────────────────────────────────────────

interface GroupMessageParams {
  adapter: ReturnType<typeof getWhatsAppAdapter>;
  inbound: Awaited<ReturnType<ReturnType<typeof getWhatsAppAdapter>['parseInbound']>>;
  phoneNumber: string;
  content: string;
  displayName: string | undefined;
  groupId: string;
  requestId: string;
}

async function processGroupMessage(params: GroupMessageParams): Promise<void> {
  const { adapter, inbound, phoneNumber, content, displayName, groupId, requestId } = params;

  // Resolve user identity (same as 1:1 — links phone to Sandra user)
  const identity = await resolveChannelIdentity({
    channel: 'whatsapp',
    externalId: phoneNumber,
    displayName,
    metadata: { requestId, groupId },
  });

  const userId = identity.userId;

  // Try to auto-link to Workspace identity (best-effort)
  const wsIdentity = await tryAutoLink(userId, phoneNumber).catch(() => null);
  const resolvedName = wsIdentity?.name ?? displayName;

  // Group sessions are keyed by group ID, not individual phone
  const groupSessionId = buildGroupSessionId(groupId);

  // Always store the message in the group session for context
  // (even if Sandra isn't mentioned — she sees the full conversation)
  await storeGroupMessage({
    sessionId: groupSessionId,
    groupId,
    senderPhone: phoneNumber,
    senderName: resolvedName,
    userId,
    content,
  });

// Respond if Sandra is mentioned OR if the message is a reply to Sandra
    const mentioned = isSandraMentioned(content);
    const repliedToSandra = isReplyToSandra(inbound.metadata);

    if (!mentioned && !repliedToSandra) {
      log.info('Group message stored (Sandra not mentioned/replied-to)', {
        from: `${phoneNumber.slice(0, 4)}****`,
        groupId: `${groupId.slice(0, 8)}...`,
      });
      return;
    }

    log.info('Sandra triggered in group — generating response', {
      from: `${phoneNumber.slice(0, 4)}****`,
      groupId: `${groupId.slice(0, 8)}...`,
      trigger: mentioned ? 'mention' : 'reply',
  });

  // Show typing indicator in the group
  void adapter.sendTypingIndicator(groupId);

  // Ensure session continuity for the group session
  const language = resolveLanguage({ explicit: undefined });

  await ensureSessionContinuity({
    sessionId: groupSessionId,
    channel: 'whatsapp',
    language,
    userId,
  });

  // Strip the mention from the message so the agent gets a clean query
  const cleanMessage = stripMention(content);

  // Build group context prefix so the agent knows who's speaking
  const groupContext = formatGroupContext(resolvedName, phoneNumber, groupId);

  // Check if this user has granted sharing permission
  const sharingNote = await getGroupSharingNote(userId);

  const scopes = getScopesForRole(wsIdentity ? 'student' : 'guest');
  const result = await runSandraAgent({
    message: `${groupContext}\n${sharingNote}\n${cleanMessage}`,
    sessionId: groupSessionId,
    userId,
    language,
    channel: 'whatsapp',
    senderName: resolvedName,
    attachments: inbound.attachments,
    scopes,
    metadata: {
      requestId,
      source: 'whatsapp-group',
      phoneNumber,
      groupId,
      isGroup: true,
      workspaceEmail: wsIdentity?.email,
    },
  });

  // Reply to the GROUP (not the individual sender)
  const chunks = splitForWhatsApp(result.response);
  for (const chunk of chunks) {
    await adapter.send({
      channelType: 'whatsapp',
      recipientId: groupId,
      content: chunk,
      language: result.language,
    });
  }

  log.info('WhatsApp group reply sent', {
    groupId: `${groupId.slice(0, 8)}...`,
    mentionedBy: `${phoneNumber.slice(0, 4)}****`,
    chunks: chunks.length,
    toolsUsed: result.toolsUsed,
  });
}
