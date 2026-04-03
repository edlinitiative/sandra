import { NextResponse } from 'next/server';
import { getWhatsAppAdapter } from '@/lib/channels/whatsapp';
import { resolveChannelIdentity } from '@/lib/channels/channel-identity';
import { runSandraAgent } from '@/lib/agents';
import { ensureSessionContinuity, getOrCreateSessionForChannel } from '@/lib/memory/session-continuity';
import { resolveLanguage } from '@/lib/i18n';
import { getScopesForRole } from '@/lib/auth';
import { setCorrelationId, clearCorrelationId } from '@/lib/tools/resilience';
import { generateRequestId, createLogger } from '@/lib/utils';
import { splitForWhatsApp } from '@/lib/channels/whatsapp-formatter';
import { isSandraMentioned, stripMention, buildGroupSessionId, formatGroupContext } from '@/lib/channels/whatsapp-group';
import { storeGroupMessage, getGroupSharingNote } from '@/lib/channels/group-privacy';
import { tryAutoLink, getWorkspaceIdentity } from '@/lib/channels/identity-linker';

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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // Await processing — errors are caught inside so we always reach the 200
  await processWebhookAsync(rawBody, requestId);

  return NextResponse.json({ status: 'ok' }, { status: 200 });
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
    const resolvedName = wsIdentity?.name ?? displayName ?? undefined;
    if (wsIdentity) {
      log.info('Workspace identity linked', { userId, email: wsIdentity.email });
    }

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
    const scopes = getScopesForRole('guest');
    const result = await runSandraAgent({
      message: content,
      sessionId,
      userId,
      language,
      channel: 'whatsapp',
      senderName: resolvedName,
      attachments: inbound.attachments,
      scopes,
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

  // Only respond if Sandra is mentioned
  if (!isSandraMentioned(content)) {
    log.info('Group message stored (Sandra not mentioned)', {
      from: `${phoneNumber.slice(0, 4)}****`,
      groupId: `${groupId.slice(0, 8)}...`,
    });
    return;
  }

  log.info('Sandra mentioned in group — generating response', {
    from: `${phoneNumber.slice(0, 4)}****`,
    groupId: `${groupId.slice(0, 8)}...`,
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

  const scopes = getScopesForRole('guest');
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
