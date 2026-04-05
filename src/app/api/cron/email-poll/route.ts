/**
 * GET /api/cron/email-poll
 *
 * Polls the sandra@edlight.org Gmail inbox for unread messages, processes each
 * one through the Sandra agent, sends a reply in the same thread, then marks
 * the original message as read.
 *
 * This replaces the SendGrid Inbound Parse webhook. No external email service
 * is needed — everything goes through the existing Google Workspace integration.
 *
 * Authentication (one of):
 *   • Vercel Cron: `Authorization: Bearer <CRON_SECRET>` header
 *   • Manual trigger: `x-api-key: <ADMIN_API_KEY>` header
 *
 * Vercel cron schedule (vercel.json):
 *   "* /5 * * * *"  →  every 5 minutes
 */

import { NextResponse } from 'next/server';
import { env } from '@/lib/config';
import { getEmailAdapter } from '@/lib/channels/email';
import { resolveChannelIdentity } from '@/lib/channels/channel-identity';
import { runSandraAgent } from '@/lib/agents';
import { ensureSessionContinuity, getOrCreateSessionForChannel } from '@/lib/memory/session-continuity';
import { resolveLanguage } from '@/lib/i18n';
import { getScopesForRole } from '@/lib/auth';
import { setCorrelationId, clearCorrelationId } from '@/lib/tools/resilience';
import { generateRequestId, createLogger } from '@/lib/utils';
import { extractEmailReply } from '@/lib/channels/email-formatter';
import { listMessages, markAsRead } from '@/lib/google/gmail';
import { resolveGoogleContext } from '@/lib/google/context';

const log = createLogger('cron:email-poll');

const EDLIGHT_TENANT_ID = 'cmnhsjh850000a1y1b69ji257';

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader && env.CRON_SECRET) {
    if (authHeader.replace(/^Bearer\s+/i, '') === env.CRON_SECRET) return true;
  }
  const apiKey = request.headers.get('x-api-key');
  if (apiKey && env.ADMIN_API_KEY && apiKey === env.ADMIN_API_KEY) return true;
  return false;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  const adapter = getEmailAdapter();

  if (!adapter.isConfigured()) {
    log.warn('Email adapter not configured — skipping poll');
    return NextResponse.json({ skipped: true, reason: 'not_configured' });
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const ctx = await resolveGoogleContext(EDLIGHT_TENANT_ID, adapter.sandraEmail);

    // Fetch up to 20 unread inbox messages per run
    const messages = await listMessages(ctx, {
      q: 'is:unread in:inbox',
      maxResults: 20,
    });

    log.info('Email poll: found unread messages', { count: messages.length });

    for (const msg of messages) {
      const requestId = generateRequestId();
      setCorrelationId(requestId);

      try {
        // Skip messages sent by Sandra itself to avoid reply loops
        const fromAddr = msg.from.toLowerCase();
        if (fromAddr.includes(adapter.sandraEmail.toLowerCase())) {
          await markAsRead(ctx, msg.messageId).catch(() => {});
          skipped++;
          continue;
        }

        let inbound;
        try {
          inbound = adapter.parseGmailMessage(msg);
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'unknown';
          if (reason.startsWith('SKIP:')) {
            log.info('Skipping message', { messageId: msg.messageId, reason });
          } else {
            log.warn('Failed to parse message', { messageId: msg.messageId, reason });
          }
          await markAsRead(ctx, msg.messageId).catch(() => {});
          skipped++;
          continue;
        }

        const { channelUserId: fromEmail, content, metadata } = inbound;
        const subject = metadata?.subject as string | undefined;

        // Strip quoted reply history
        const cleanContent = extractEmailReply(content);
        if (!cleanContent) {
          log.info('SKIP: Empty after stripping quoted history', { messageId: msg.messageId });
          await markAsRead(ctx, msg.messageId).catch(() => {});
          skipped++;
          continue;
        }

        log.info('Processing email', { from: fromEmail.slice(0, 6) + '****', requestId });

        // Resolve channel identity → Sandra user
        const identity = await resolveChannelIdentity({
          channel: 'email',
          externalId: fromEmail,
          displayName: metadata?.fromName as string | undefined,
          metadata: { requestId },
        });

        const userId = identity.userId;

        // Deterministic session per email address
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
          metadata: { requestId, source: 'email', subject, inReplyTo: msg.messageId },
        });

        // Reply in the same Gmail thread
        await adapter.send({
          channelType: 'email',
          recipientId: fromEmail,
          content: result.response,
          language: result.language,
          metadata: {
            subject,
            emailMessageId: msg.messageId,
            gmailThreadId: msg.threadId,
          },
        });

        // Mark original as read so it won't be picked up again
        await markAsRead(ctx, msg.messageId).catch(() => {});

        log.info('Email processed and replied', {
          to: fromEmail.slice(0, 6) + '****',
          toolsUsed: result.toolsUsed,
        });

        processed++;
      } catch (error) {
        log.error('Failed to process email message', {
          messageId: msg.messageId,
          error: error instanceof Error ? error.message : 'unknown',
        });
        failed++;
      } finally {
        clearCorrelationId();
      }
    }
  } catch (error) {
    log.error('Email poll failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Poll failed', detail: error instanceof Error ? error.message : 'unknown' },
      { status: 500 },
    );
  }

  const durationMs = Date.now() - start;
  log.info('Email poll complete', { processed, skipped, failed, durationMs });

  return NextResponse.json({ processed, skipped, failed, durationMs });
}
