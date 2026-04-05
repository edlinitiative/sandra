/**
 * GET /api/cron/process-reminders
 *
 * Scans ActionRequest rows for queued reminders whose scheduledAt has passed,
 * delivers each one via the stored channel, and marks them as executed.
 *
 * Delivery strategy:
 *   • whatsapp  — sends via Meta Cloud API using the user's ChannelIdentity
 *   • email     — sends via Gmail API using user's ChannelIdentity or User.email
 *   • web       — writes an assistant message into the session (visible on next load)
 *   • instagram — writes an assistant message into the session (no push API)
 *
 * Authentication (one of):
 *   • Vercel Cron: `Authorization: Bearer <CRON_SECRET>` header
 *   • Manual trigger: `x-api-key: <ADMIN_API_KEY>` header
 *
 * Cron schedule (vercel.json): every minute — "* * * * *"
 */

import { NextResponse } from 'next/server';
import { env } from '@/lib/config';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';
import { logAuditEvent } from '@/lib/audit';
import { resolveGoogleContext } from '@/lib/google/context';
import { sendEmail } from '@/lib/google/gmail';

const log = createLogger('cron:process-reminders');

const EDLIGHT_TENANT_ID = 'cmnhsjh850000a1y1b69ji257';
const MAX_PER_RUN = 50;

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
  const now = new Date();

  // Fetch all pending queueReminder actions (unprocessed)
  const pending = await db.actionRequest.findMany({
    where: { tool: 'queueReminder', status: 'pending' },
    orderBy: { requestedAt: 'asc' },
    take: MAX_PER_RUN,
  });

  // Filter to those whose scheduledAt has passed
  const due = pending.filter((r) => {
    const meta = r.metadata as Record<string, unknown> | null;
    if (!meta?.scheduledAt) return true; // no schedule = deliver immediately
    return new Date(meta.scheduledAt as string) <= now;
  });

  if (due.length === 0) {
    return NextResponse.json({
      status: 'ok',
      delivered: 0,
      skipped: pending.length,
      durationMs: Date.now() - start,
    });
  }

  log.info(`Processing ${due.length} due reminder(s)`);

  let delivered = 0;
  const errors: string[] = [];

  for (const reminder of due) {
    const input = reminder.input as Record<string, unknown>;
    const message = (input.message as string) ?? '(no message)';
    const channel = (input.channel as string) ?? reminder.channel ?? 'web';

    try {
      await deliverReminder(message, channel, reminder.userId, reminder.sessionId);

      await db.actionRequest.update({
        where: { id: reminder.id },
        data: {
          status: 'executed',
          reviewedAt: new Date(),
          result: {
            delivered: true,
            deliveredAt: new Date().toISOString(),
            channel,
          },
        },
      });

      delivered++;
      log.info(`Delivered reminder ${reminder.id} via ${channel}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      log.error(`Failed to deliver reminder ${reminder.id}`, { error: msg, channel });
      errors.push(`${reminder.id.slice(0, 8)}: ${msg}`);

      // Mark failed so it doesn't retry forever
      await db.actionRequest
        .update({
          where: { id: reminder.id },
          data: { status: 'failed', result: { delivered: false, error: msg } },
        })
        .catch(() => {});
    }
  }

  await logAuditEvent({
    action: 'system_action',
    resource: 'cron:process-reminders',
    details: { delivered, failed: errors.length, durationMs: Date.now() - start },
    success: errors.length === 0,
  }).catch(() => {});

  return NextResponse.json({
    status: 'ok',
    delivered,
    failed: errors.length,
    ...(errors.length > 0 ? { errors } : {}),
    durationMs: Date.now() - start,
  });
}

// ─── Delivery helpers ─────────────────────────────────────────────────────────

async function deliverReminder(
  message: string,
  channel: string,
  userId: string | null,
  sessionId: string | null,
): Promise<void> {
  switch (channel) {
    case 'whatsapp':
      await deliverViaWhatsApp(userId, message);
      break;
    case 'email':
      await deliverViaEmail(userId, message);
      break;
    case 'web':
    case 'instagram':
    default:
      await deliverToSession(sessionId, message);
      break;
  }
}

/** Send outbound WhatsApp message using the user's registered phone number. */
async function deliverViaWhatsApp(userId: string | null, message: string): Promise<void> {
  if (!userId) throw new Error('No userId — cannot look up WhatsApp identity');

  const identity = await db.channelIdentity.findFirst({
    where: { userId, channel: 'whatsapp' },
  });
  if (!identity) throw new Error(`No WhatsApp identity on record for user ${userId}`);

  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = env.WHATSAPP_API_VERSION;
  if (!phoneNumberId || !accessToken) throw new Error('WhatsApp Cloud API not configured');

  const res = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: identity.externalId,
        type: 'text',
        text: { preview_url: false, body: `🔔 Reminder: ${message}` },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${body}`);
  }
}

/** Send email via Gmail API using the user's registered email address. */
async function deliverViaEmail(userId: string | null, message: string): Promise<void> {
  if (!userId) throw new Error('No userId — cannot look up email address');

  const [identity, user] = await Promise.all([
    db.channelIdentity.findFirst({ where: { userId, channel: 'email' } }),
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  const toEmail = identity?.externalId ?? user?.email;
  if (!toEmail) throw new Error(`No email address on record for user ${userId}`);
  if (!env.SANDRA_EMAIL_ADDRESS) throw new Error('SANDRA_EMAIL_ADDRESS not configured');

  const ctx = await resolveGoogleContext(EDLIGHT_TENANT_ID);
  await sendEmail(ctx, {
    from: env.SANDRA_EMAIL_ADDRESS,
    to: [toEmail],
    subject: '🔔 Sandra Reminder',
    body: `🔔 Reminder from Sandra:\n\n${message}`,
  });
}

/**
 * Write a reminder as an assistant message in the session.
 * The user will see it the next time they open their chat.
 */
async function deliverToSession(sessionId: string | null, message: string): Promise<void> {
  if (!sessionId) throw new Error('No sessionId — cannot deliver to web session');

  await db.message.create({
    data: {
      sessionId,
      role: 'assistant',
      content: `🔔 **Reminder:** ${message}`,
      language: 'en',
      metadata: { type: 'reminder', deliveredAt: new Date().toISOString() },
    },
  });
}
