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

    log.info('Processing WhatsApp inbound message', {
      from: `${phoneNumber.slice(0, 4)}****`,
      requestId,
    });

    // Mark message as read and show typing indicator (best-effort)
    if (whatsappMessageId) {
      void adapter.markAsRead(whatsappMessageId);
    }
    void adapter.sendTypingIndicator(phoneNumber);

    // Resolve or create channel identity → Sandra user (auto-creates if new phone)
    const identity = await resolveChannelIdentity({
      channel: 'whatsapp',
      externalId: phoneNumber,
      displayName: displayName ?? undefined,
      metadata: { requestId },
    });

    const userId = identity.userId;

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
      senderName: displayName ?? undefined,
      attachments: inbound.attachments,
      scopes,
      metadata: { requestId, source: 'whatsapp', phoneNumber },
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
