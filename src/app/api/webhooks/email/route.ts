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
import {
  hasAgentSignature,
  hasAgentLoopSentinel,
  stripAgentLoopSentinel,
} from '@/lib/channels/agent-loop-guard';
import { getRequestIp, logWebhookEvent } from '@/lib/webhooks/logger';

const log = createLogger('api:webhooks:email');

// ─── POST — SendGrid Inbound Parse webhook ────────────────────────────────────

export async function POST(request: Request) {
  const requestId = generateRequestId();
  setCorrelationId(requestId);
  const requestIp = getRequestIp(request);

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
      await logWebhookEvent({
        channel: 'email',
        action: 'webhook_failed',
        requestId,
        ip: requestIp,
        details: { stage: 'decode', reason: 'unsupported_payload' },
      });
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }
  }

  await logWebhookEvent({
    channel: 'email',
    action: 'webhook_received',
    requestId,
    ip: requestIp,
    details: {
      from: fields.from ?? null,
      subject: fields.subject ?? null,
      messageId: fields.headers ? null : (fields['Message-Id'] ?? null),
    },
  });

  // Await processing — errors are caught inside so we always reach the 200
  await processEmailAsync(fields, requestId, requestIp);

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

// ─── Background processing ────────────────────────────────────────────────────

async function processEmailAsync(
  fields: Record<string, string>,
  requestId: string,
  requestIp?: string,
): Promise<void> {
  try {
    const adapter = getEmailAdapter();

    if (!adapter.isConfigured()) {
      await logWebhookEvent({
        channel: 'email',
        action: 'webhook_skipped',
        requestId,
        ip: requestIp,
        details: { stage: 'config', reason: 'adapter_not_configured' },
      });
      log.warn('Email adapter not configured — skipping inbound email');
      return;
    }

    let inbound;
    try {
      inbound = await adapter.parseInbound(fields);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg.startsWith('SKIP:')) {
        await logWebhookEvent({
          channel: 'email',
          action: 'webhook_skipped',
          requestId,
          ip: requestIp,
          details: { stage: 'parse', reason: msg },
        });
        log.info('Skipping email event', { reason: msg });
      } else {
        await logWebhookEvent({
          channel: 'email',
          action: 'webhook_failed',
          requestId,
          ip: requestIp,
          details: { stage: 'parse', reason: msg },
        });
        log.warn('Failed to parse inbound email', { error: msg });
      }
      return;
    }

    const { channelUserId: fromEmail, content, metadata } = inbound;
    const subject = metadata?.subject as string | undefined;
    const emailMessageId = metadata?.emailMessageId as string | undefined;

    // Strip quoted history from replies
    const cleanContent = stripAgentLoopSentinel(extractEmailReply(content));
    const isAgentMessage = metadata?.agentLoopTagged === true
      || hasAgentLoopSentinel(cleanContent)
      || hasAgentSignature(cleanContent);
    if (isAgentMessage) {
      await logWebhookEvent({
        channel: 'email',
        action: 'webhook_skipped',
        requestId,
        ip: requestIp,
        details: { stage: 'loop_guard', reason: 'agent_originated' },
      });
      log.info('SKIP: Agent-originated inbound email detected');
      return;
    }
    if (!cleanContent) {
      await logWebhookEvent({
        channel: 'email',
        action: 'webhook_skipped',
        requestId,
        ip: requestIp,
        details: { stage: 'content', reason: 'empty_after_strip' },
      });
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

    await logWebhookEvent({
      channel: 'email',
      action: 'webhook_processed',
      requestId,
      ip: requestIp,
      sessionId,
      userId,
      details: {
        from: fromEmail,
        subject: subject ?? null,
        toolsUsed: result.toolsUsed,
      },
    });
  } catch (error) {
    await logWebhookEvent({
      channel: 'email',
      action: 'webhook_failed',
      requestId,
      ip: requestIp,
      details: { stage: 'process', reason: error instanceof Error ? error.message : 'unknown' },
    });
    log.error('Email webhook processing error', {
      error: error instanceof Error ? error.message : 'unknown',
      requestId,
    });
  } finally {
    clearCorrelationId();
  }
}
