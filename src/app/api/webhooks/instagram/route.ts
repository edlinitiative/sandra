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

    // Fetch sender's name for personalised responses (best-effort)
    const senderName = await adapter.fetchSenderName(psid);

    log.info('Processing Instagram inbound DM', {
      from: `${psid.slice(0, 4)}****`,
      senderName: senderName ?? 'unknown',
      requestId,
    });

    // Show typing indicator immediately so the user knows Sandra is working
    void adapter.sendTypingIndicator(psid, pageId);

    // Resolve or create channel identity → Sandra user
    const identity = await resolveChannelIdentity({
      channel: 'instagram',
      externalId: psid,
      metadata: { requestId },
    });

    const userId = identity.userId;

    // Resolve session
    const session = await getOrCreateSessionForChannel({
      channel: 'instagram',
      channelUserId: psid,
      userId,
    });

    const sessionId = session.sessionId;
    const language = resolveLanguage({ explicit: undefined, sessionLanguage: session.language });

    await ensureSessionContinuity({ sessionId, channel: 'instagram', language, userId });

    const scopes = getScopesForRole('guest');
    const result = await runSandraAgent({
      message: content,
      sessionId,
      userId,
      language,
      channel: 'instagram',
      senderName: senderName ?? undefined,
      attachments: inbound.attachments,
      scopes,
      metadata: { requestId, source: 'instagram', psid },
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
