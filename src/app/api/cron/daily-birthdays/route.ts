/**
 * GET /api/cron/daily-birthdays
 *
 * Scheduled daily cron job — scans all birthday sources, creates Google
 * Tasks for each person whose birthday is today, and sends a WhatsApp
 * summary to the admin.
 *
 * Authentication (one of):
 *   • Vercel Cron: `Authorization: Bearer <CRON_SECRET>` header (set automatically by Vercel)
 *   • Manual trigger: `x-api-key: <ADMIN_API_KEY>` header
 *
 * The cron schedule is configured in vercel.json:
 *   "crons": [{ "path": "/api/cron/daily-birthdays", "schedule": "0 10 * * *" }]
 *   → Runs at 10:00 UTC every day (≈ 5 AM Haiti, 6 AM ET)
 */

import { NextResponse } from 'next/server';
import { env } from '@/lib/config';
import { scanBirthdays, sendWhatsAppAlert } from '@/lib/tools/check-birthdays';
import { resolveGoogleContext } from '@/lib/google/context';
import { createTask } from '@/lib/google/tasks';
import { logAuditEvent } from '@/lib/audit';
import { createLogger } from '@/lib/utils';

const log = createLogger('cron:daily-birthdays');

/** Hard-coded EdLight tenant — same as used in /api/index/drive */
const EDLIGHT_TENANT_ID = 'cmnhsjh850000a1y1b69ji257';

// ─── Auth ────────────────────────────────────────────────────────────────────

function verifyCronAuth(request: Request): boolean {
  // 1. Vercel Cron header (Authorization: Bearer <CRON_SECRET>)
  const authHeader = request.headers.get('authorization');
  if (authHeader && env.CRON_SECRET) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === env.CRON_SECRET) return true;
  }

  // 2. Admin API key (x-api-key: <ADMIN_API_KEY>)
  const apiKey = request.headers.get('x-api-key');
  if (apiKey && env.ADMIN_API_KEY && apiKey === env.ADMIN_API_KEY) return true;

  return false;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const start = Date.now();

  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    log.info('Daily birthday cron started');

    // ── 1. Scan all sources ──────────────────────────────────────────────
    const result = await scanBirthdays({ tenantId: EDLIGHT_TENANT_ID });

    log.info('Birthday scan complete', {
      count: result.count,
      sourceLog: result.sourceLog,
    });

    if (result.count === 0) {
      await logAuditEvent({
        action: 'system_action',
        resource: 'cron:daily-birthdays',
        details: { today: result.today, count: 0, sourceLog: result.sourceLog },
        success: true,
      }).catch(() => {});

      return NextResponse.json({
        status: 'ok',
        today: result.today,
        count: 0,
        sourceLog: result.sourceLog,
        message: `No birthdays today (${result.dateLabel}).`,
        tasksCreated: 0,
        durationMs: Date.now() - start,
      });
    }

    // ── 2. Create a Google Task for each birthday ────────────────────────
    //    Tasks are created on the admin's task list so the team can see
    //    and check them off after sending wishes.
    const tasksCreated: Array<{ name: string; taskId: string }> = [];
    const taskErrors: string[] = [];

    try {
      const ctx = await resolveGoogleContext(EDLIGHT_TENANT_ID);

      for (const b of result.birthdays) {
        try {
          const todayISO = new Date().toISOString().substring(0, 10);
          const taskResult = await createTask(ctx, {
            title: `🎂 Wish ${b.name} a happy birthday — ${b.contactTypeLabel}`,
            notes:
              `Birthday: ${result.dateLabel}\n` +
              `Type: ${b.contactTypeLabel}\n` +
              (b.email ? `Email: ${b.email}\n` : '') +
              (b.phone ? `Phone: ${b.phone}\n` : '') +
              `Source: ${b.source}\n\n` +
              `--- Draft message ---\n${b.draftMessage}`,
            dueDate: todayISO,
          });
          tasksCreated.push({ name: b.name, taskId: taskResult.taskId });
        } catch (err) {
          const msg = `Task for ${b.name}: ${err instanceof Error ? err.message : String(err)}`;
          log.warn(msg);
          taskErrors.push(msg);
        }
      }
    } catch (err) {
      const msg = `Could not connect to Google Tasks: ${err instanceof Error ? err.message : String(err)}`;
      log.warn(msg);
      taskErrors.push(msg);
    }

    log.info('Tasks created', { count: tasksCreated.length, errors: taskErrors.length });

    // ── 3. Send WhatsApp summary to admin ────────────────────────────────
    let whatsappMessageId: string | null = null;
    let whatsappError: string | null = null;
    const adminPhone = env.BIRTHDAY_ADMIN_PHONE;

    if (adminPhone) {
      // Append a task summary line to the alert
      const taskLine = tasksCreated.length > 0
        ? `\n\n✅ ${tasksCreated.length} Google Task${tasksCreated.length === 1 ? '' : 's'} created — check your Tasks list to track wishes.`
        : '';
      const fullAlert = result.alertText + taskLine;

      try {
        whatsappMessageId = await sendWhatsAppAlert(adminPhone, fullAlert);
      } catch (err) {
        whatsappError = err instanceof Error ? err.message : String(err);
        log.warn('WhatsApp alert failed', { error: whatsappError });
      }
    }

    // ── 4. Audit log ─────────────────────────────────────────────────────
    await logAuditEvent({
      action: 'system_action',
      resource: 'cron:daily-birthdays',
      details: {
        today: result.today,
        count: result.count,
        sourceLog: result.sourceLog,
        tasksCreated: tasksCreated.length,
        taskErrors: taskErrors.length,
        whatsappSent: !!whatsappMessageId,
      },
      success: true,
    }).catch(() => {});

    const durationMs = Date.now() - start;
    log.info('Daily birthday cron complete', { durationMs });

    return NextResponse.json({
      status: 'ok',
      today: result.today,
      dateLabel: result.dateLabel,
      count: result.count,
      sourceLog: result.sourceLog,
      tasksCreated: tasksCreated.length,
      taskDetails: tasksCreated,
      taskErrors: taskErrors.length > 0 ? taskErrors : undefined,
      whatsappMessageId,
      whatsappError,
      durationMs,
    });
  } catch (error) {
    log.error('Daily birthday cron failed', { error });

    await logAuditEvent({
      action: 'system_action',
      resource: 'cron:daily-birthdays',
      details: { error: error instanceof Error ? error.message : String(error) },
      success: false,
    }).catch(() => {});

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - start,
      },
      { status: 500 },
    );
  }
}
