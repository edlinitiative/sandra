import { NextResponse } from 'next/server';
import { getEmailAdapter } from '@/lib/channels/email';
import { resolveChannelIdentity } from '@/lib/channels/channel-identity';
import { runSandraAgent } from '@/lib/agents';
import { ensureSessionContinuity, getOrCreateSessionForChannel } from '@/lib/memory/session-continuity';
import { resolveLanguage } from '@/lib/i18n';
import { getScopesForRole } from '@/lib/auth';
import { setCorrelationId, clearCorrelationId } from '@/lib/tools/resilience';
import { generateRequestId, createLogger } from '@/lib/utils';
import { extractEmailReply } from '@/lib/channels/email-formatter';

const log = createLogger('api:webhooks:email');

// ─── POST — SendGrid Inbound Parse webhook ────────────────────────────────────

export async function POST(request: Request) {
  const requestId = generateRequestId();
  setCorrelationId(requestId);

  // SendGrid Inbound Parse sends multipart/form-data
  let fields: Record<string, string>;
  try {
    const formData = await request.formData();
    fields = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        fields[key] = value;
      }
    }
  } catch {
    // Fallback: try JSON (for testing / non-SendGrid senders)
    try {
      const json = await request.clone().json() as Record<string, string>;
      fields = json;
    } catch {
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }
  }

  // Await processing — errors are caught inside so we always reach the 200
  await processEmailAsync(fields, requestId);

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

// ─── Background processing ────────────────────────────────────────────────────

async function processEmailAsync(
  fields: Record<string, string>,
  requestId: string,
): Promise<void> {
  try {
    const adapter = getEmailAdapter();

    if (!adapter.isConfigured()) {
      log.warn('Email adapter not configured — skipping inbound email');
      return;
    }

    let inbound;
    try {
      inbound = await adapter.parseInbound(fields);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg.startsWith('SKIP:')) {
        log.info('Skipping email event', { reason: msg });
      } else {
        log.warn('Failed to parse inbound email', { error: msg });
      }
      return;
    }

    const { channelUserId: fromEmail, content, metadata } = inbound;
    const subject = metadata?.subject as string | undefined;
    const emailMessageId = metadata?.emailMessageId as string | undefined;

    // Strip quoted history from replies
    const cleanContent = extractEmailReply(content);
    if (!cleanContent) {
      log.info('SKIP: Empty email after stripping quoted history');
      return;
    }

    log.info('Processing inbound email', { from: fromEmail.slice(0, 6) + '****', requestId });

    // Resolve or create channel identity → Sandra user
    const identity = await resolveChannelIdentity({
      channel: 'email',
      externalId: fromEmail,
      displayName: metadata?.fromName as string | undefined,
      metadata: { requestId },
    });

    const userId = identity.userId;

    // Resolve session (email address is stable — deterministic session)
    const session = await getOrCreateSessionForChannel({
      channel: 'email',
      channelUserId: fromEmail,
      userId,
    });

    const sessionId = session.sessionId;
    const language = resolveLanguage({ explicit: undefined, sessionLanguage: session.language });

    await ensureSessionContinuity({ sessionId, channel: 'email', language, userId });

    const scopes = getScopesForRole('guest');
    const result = await runSandraAgent({
      message: cleanContent,
      sessionId,
      userId,
      language,
      channel: 'email',
      scopes,
      metadata: { requestId, source: 'email', subject, inReplyTo: emailMessageId },
    });

    // Send reply email
    await adapter.send({
      channelType: 'email',
      recipientId: fromEmail,
      content: result.response,
      language: result.language,
      metadata: {
        subject,
        inReplyTo: emailMessageId,
      },
    });

    log.info('Email reply sent', {
      to: fromEmail.slice(0, 6) + '****',
      toolsUsed: result.toolsUsed,
    });
  } catch (error) {
    log.error('Email webhook processing error', {
      error: error instanceof Error ? error.message : 'unknown',
      requestId,
    });
  } finally {
    clearCorrelationId();
  }
}
