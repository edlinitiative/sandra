/**
 * checkBirthdays — scan multiple sources for today's birthdays, draft
 * personalised messages per contact type, and send a WhatsApp alert to
 * the configured admin phone number.
 *
 * Sources (all enabled by default; each silently skipped if not configured):
 *
 *   1. **Google Contacts** (People API)
 *      Reads birthday fields from the Workspace directory — all alumni and
 *      contacts stored there with a birthday set.
 *
 *   2. **Google Drive sheets** (auto-discovery)
 *      Scans every Google Spreadsheet accessible to the service account,
 *      detects columns named "Birthday", "Date of Birth", "DOB", etc.,
 *      and extracts any row whose birthday matches today.
 *      This covers all Google Form response sheets (ESLP applications,
 *      alumni surveys, etc.) without manual configuration.
 *
 *   3. **Fixed contacts sheet** (optional)
 *      If `spreadsheetId` is passed or BIRTHDAY_CONTACTS_SHEET_ID is set,
 *      also reads a manually maintained contacts list.
 *
 * Contact types — determines which birthday message draft is generated:
 *   - general          : general contacts / supporters
 *   - eslp_rejected    : applied to ESLP but not selected
 *   - current_member   : active fellows / program participants
 *   - eslp_alumni      : ESLP graduates
 *
 * The core scan logic is exported as `scanBirthdays()` so that the daily
 * cron job at /api/cron/daily-birthdays can also call it directly.
 *
 * Required scopes: contacts:read, whatsapp:send
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { listDirectoryPeopleWithBirthdays } from '@/lib/google/directory';
import { readSheetRows, findSheetsWithBirthdayData, parseBirthdayToMMDD } from '@/lib/google/drive';
import { logAuditEvent } from '@/lib/audit';
import { env } from '@/lib/config';
import type { GoogleWorkspaceContext } from '@/lib/google/types';

// ─── Exported Types ──────────────────────────────────────────────────────────

export type ContactType = 'general' | 'eslp_rejected' | 'current_member' | 'eslp_alumni';

export interface NormalisedContact {
  name: string;
  email: string;
  phone: string;
  birthday: string;     // MM-DD
  contactType: ContactType;
  source: string;       // "contacts" | "sheet:<fileName>" | "fixed_sheet"
}

export interface BirthdayOutput {
  name: string;
  email: string;
  phone: string;
  contactType: ContactType;
  contactTypeLabel: string;
  source: string;
  draftMessage: string;
}

export interface ScanBirthdaysResult {
  today: string;
  dateLabel: string;
  count: number;
  sourceLog: string[];
  birthdays: BirthdayOutput[];
  alertText: string;
}

export interface ScanBirthdaysOptions {
  tenantId: string;
  sources?: ('contacts' | 'forms' | 'sheet')[];
  spreadsheetId?: string;
  sheetRange?: string;
}

// ─── Input schema ─────────────────────────────────────────────────────────────

const inputSchema = z.object({
  spreadsheetId: z
    .string()
    .min(1)
    .optional()
    .describe('Google Sheets file ID for a manually maintained contacts list (optional; falls back to BIRTHDAY_CONTACTS_SHEET_ID env var).'),
  sheetRange: z
    .string()
    .optional()
    .default('Contacts!A:G')
    .describe('A1-notation range for the fixed contacts sheet. Default: "Contacts!A:G"'),
  adminPhone: z
    .string()
    .optional()
    .describe('Admin WhatsApp number to notify (international format, no +). Falls back to BIRTHDAY_ADMIN_PHONE env var.'),
  sources: z
    .array(z.enum(['contacts', 'forms', 'sheet']))
    .optional()
    .describe('Sources to check. Defaults to all available: ["contacts", "forms", "sheet"].'),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, return results without sending a WhatsApp message.'),
});

// ─── Contact-type helpers ─────────────────────────────────────────────────────

/**
 * Infer contact type from a sheet/file name.
 * e.g. "ESLP 2024 (Responses)" → eslp_rejected (applicants, not yet members)
 *      "Alumni Survey (Responses)" → eslp_alumni
 */
function inferTypeFromSheetName(name: string): ContactType {
  const n = name.toLowerCase();
  if (n.includes('alumni') || n.includes('alum') || n.includes('graduate') || n.includes('diplômé')) return 'eslp_alumni';
  if (n.includes('member') || n.includes('fellow') || n.includes('current') || n.includes('actif')) return 'current_member';
  if (n.includes('reject') || n.includes('not selected') || n.includes('waitlist')) return 'eslp_rejected';
  // ESLP application sheets → applicants (may include rejected + accepted)
  if (n.includes('eslp') || n.includes('application') || n.includes('candidature')) return 'eslp_rejected';
  return 'general';
}

/** Map a raw "Type" column string to ContactType. */
function parseContactType(raw: string): ContactType {
  const s = raw.trim().toLowerCase().replace(/[\s-]/g, '_');
  if (s.includes('alumni') || s.includes('alum') || s.includes('graduate')) return 'eslp_alumni';
  if (s.includes('member') || s.includes('fellow') || s.includes('current') || s.includes('active')) return 'current_member';
  if (s.includes('reject') || s.includes('applicant') || s.includes('not_accepted')) return 'eslp_rejected';
  return 'general';
}

export function contactTypeLabel(t: ContactType): string {
  switch (t) {
    case 'eslp_rejected':  return 'ESLP Applicant (not selected)';
    case 'current_member': return 'Current Member / Fellow';
    case 'eslp_alumni':    return 'ESLP Alum 🎓';
    default:               return 'General Contact';
  }
}

// ─── Birthday message drafts ──────────────────────────────────────────────────

export function draftBirthdayMessage(name: string, type: ContactType): string {
  const first = name.split(/\s+/)[0] ?? name;

  switch (type) {
    case 'current_member':
      return (
        `🎂 Happy Birthday, ${first}! 🎉\n\n` +
        `The entire EdLight family is celebrating YOU today! As an active member of our community, ` +
        `you inspire us every single day. We're so proud to have you with us and can't wait to see everything ` +
        `you'll accomplish. Wishing you an amazing birthday filled with joy, laughter, and everything you deserve! 🌟\n\n` +
        `With love,\nThe EdLight Team`
      );

    case 'eslp_alumni':
      return (
        `🎂 Happy Birthday, ${first} — ESLP Alum! 🎓🎂\n\n` +
        `Once a fellow, always a fellow! The EdLight family never forgets, and today we're celebrating YOU. ` +
        `Your ESLP journey was just the beginning — we are so proud of who you've become and how far you've come. ` +
        `Wishing you an incredible birthday surrounded by people who love and appreciate you. ✨\n\n` +
        `With pride and joy,\nThe EdLight Team`
      );

    case 'eslp_rejected':
      return (
        `🎂 Happy Birthday, ${first}! 🎉\n\n` +
        `The EdLight team is thinking of you on your special day and wishing you all the happiness in the world! ` +
        `Your ambition and passion for growth inspire us, and we're glad you're part of our extended family. ` +
        `We hope this birthday marks the start of an extraordinary new chapter for you. Keep shining! 🌟\n\n` +
        `Warm wishes,\nEdLight Initiative`
      );

    default:
      return (
        `🎂 Happy Birthday, ${first}! 🎉\n\n` +
        `On behalf of the entire EdLight team, we're wishing you a wonderful birthday filled with joy and celebration. ` +
        `You mean a lot to our community and we hope this special day brings you everything you deserve. ` +
        `Have an amazing one! 🌟\n\n` +
        `Warm regards,\nEdLight Initiative`
      );
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

/** Case-normalised key for deduplication: prefer email, fall back to normalised name */
function dedupeKey(contact: NormalisedContact): string {
  if (contact.email) return contact.email.toLowerCase().trim();
  return contact.name.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ─── Fixed sheet parsing ──────────────────────────────────────────────────────

function parseHeaderMap(row: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < row.length; i++) {
    const cell = row[i];
    if (!cell) continue;
    map[cell.trim().toLowerCase().replace(/[\s_-]+/g, '_')] = i;
  }
  return map;
}

function colIdx(map: Record<string, number>, ...keys: string[]): number {
  for (const k of keys) {
    const v = map[k];
    if (v !== undefined) return v;
  }
  return -1;
}

// ─── WhatsApp sender ──────────────────────────────────────────────────────────

export async function sendWhatsAppAlert(to: string, message: string): Promise<string> {
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion    = env.WHATSAPP_API_VERSION;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp is not configured (missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN).');
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API error: ${res.status} — ${body}`);
  }

  const data = (await res.json()) as { messages?: Array<{ id: string }> };
  return data.messages?.[0]?.id ?? 'unknown';
}

// ─── Core scan logic (reusable by tool handler + cron) ───────────────────────

/**
 * Scan all birthday sources and return deduplicated contacts with drafted
 * messages. This is the shared core used by both the interactive tool and
 * the daily cron job.
 */
export async function scanBirthdays(opts: ScanBirthdaysOptions): Promise<ScanBirthdaysResult> {
  const now   = new Date();
  const today = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const activeSources = opts.sources ?? ['contacts', 'forms', 'sheet'];

  const rawCtx = await resolveGoogleContext(opts.tenantId);

  // Use drive impersonation email if configured
  const ctx: GoogleWorkspaceContext = rawCtx.config.driveImpersonateEmail
    ? { ...rawCtx, impersonateEmail: rawCtx.config.driveImpersonateEmail }
    : rawCtx;

  const allContacts: NormalisedContact[] = [];
  const sourceLog: string[] = [];

  // ── Source 1: Google Contacts (People API) ──────────────────────────────
  if (activeSources.includes('contacts')) {
    try {
      const people = await listDirectoryPeopleWithBirthdays(ctx, today);
      for (const p of people) {
        allContacts.push({
          name: p.name, email: p.email, phone: p.phone,
          birthday: p.birthday, contactType: 'general', source: 'contacts',
        });
      }
      sourceLog.push(`Google Contacts: ${people.length} match(es)`);
    } catch (err) {
      sourceLog.push(`Google Contacts: skipped (${err instanceof Error ? err.message : 'error'})`);
    }
  }

  // ── Source 2: Google Drive Sheets (Form responses + other sheets) ───────
  if (activeSources.includes('forms')) {
    try {
      const sheetHits = await findSheetsWithBirthdayData(ctx, today);
      for (const hit of sheetHits) {
        allContacts.push({
          name: hit.name, email: hit.email, phone: hit.phone,
          birthday: hit.birthday, contactType: inferTypeFromSheetName(hit.sheetName),
          source: `sheet:${hit.sheetName}`,
        });
      }
      sourceLog.push(`Drive sheets: ${sheetHits.length} match(es)`);
    } catch (err) {
      sourceLog.push(`Drive sheets: skipped (${err instanceof Error ? err.message : 'error'})`);
    }
  }

  // ── Source 3: Fixed contacts spreadsheet ────────────────────────────────
  const fixedSheetId = opts.spreadsheetId ?? env.BIRTHDAY_CONTACTS_SHEET_ID;
  if (activeSources.includes('sheet') && fixedSheetId) {
    try {
      const rows = await readSheetRows(ctx, fixedSheetId, opts.sheetRange ?? 'Contacts!A:G');
      const firstRow = rows[0];
      if (firstRow && rows.length >= 2) {
        const hmap = parseHeaderMap(firstRow);
        const iName  = colIdx(hmap, 'name', 'full_name', 'fullname', 'contact_name');
        const iEmail = colIdx(hmap, 'email', 'email_address');
        const iPhone = colIdx(hmap, 'phone', 'phone_number', 'whatsapp', 'mobile');
        const iBday  = colIdx(hmap, 'birthday', 'birth_date', 'birthdate', 'date_of_birth', 'dob');
        const iType  = colIdx(hmap, 'type', 'contact_type', 'category', 'role', 'relationship');

        if (iName !== -1 && iBday !== -1) {
          let fixedCount = 0;
          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row) continue;
            const rawBday = row[iBday]?.trim() ?? '';
            if (!rawBday) continue;
            const mmdd = parseBirthdayToMMDD(rawBday);
            if (mmdd !== today) continue;
            allContacts.push({
              name:        row[iName]?.trim()  ?? `Row ${r + 1}`,
              email:       iEmail >= 0 ? (row[iEmail]?.trim() ?? '') : '',
              phone:       iPhone >= 0 ? (row[iPhone]?.trim() ?? '') : '',
              birthday:    mmdd,
              contactType: iType >= 0 ? parseContactType(row[iType] ?? '') : 'general',
              source:      'fixed_sheet',
            });
            fixedCount++;
          }
          sourceLog.push(`Fixed sheet: ${fixedCount} match(es)`);
        }
      }
    } catch (err) {
      sourceLog.push(`Fixed sheet: skipped (${err instanceof Error ? err.message : 'error'})`);
    }
  }

  // ── Deduplicate across sources ──────────────────────────────────────────
  const seen = new Set<string>();
  const unique: NormalisedContact[] = [];
  for (const c of allContacts) {
    const key = dedupeKey(c);
    if (!seen.has(key)) { seen.add(key); unique.push(c); }
  }

  // ── Build birthday outputs ──────────────────────────────────────────────
  const birthdayOutputs: BirthdayOutput[] = unique.map((c) => ({
    name:             c.name,
    email:            c.email,
    phone:            c.phone,
    contactType:      c.contactType,
    contactTypeLabel: contactTypeLabel(c.contactType),
    source:           c.source,
    draftMessage:     draftBirthdayMessage(c.name, c.contactType),
  }));

  // ── Build alert text ────────────────────────────────────────────────────
  const lines: string[] = [
    `🎂 *Birthday Alert — ${dateLabel}*\n`,
    `${unique.length} birthday${unique.length === 1 ? '' : 's'} across your EdLight contacts today:\n`,
  ];
  for (let i = 0; i < birthdayOutputs.length; i++) {
    const b = birthdayOutputs[i];
    if (!b) continue;
    lines.push(
      `*${i + 1}. ${b.name}* — ${b.contactTypeLabel}`,
      b.email ? `📧 ${b.email}` : '',
      b.phone ? `📱 ${b.phone}` : '',
      `\n💬 *Draft message:*\n${b.draftMessage}`,
      '',
    );
  }
  lines.push(`— Sandra | EdLight AI`);
  const alertText = lines
    .filter((l) => l !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { today, dateLabel, count: unique.length, sourceLog, birthdays: birthdayOutputs, alertText };
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

const checkBirthdays: SandraTool = {
  name: 'checkBirthdays',
  description:
    "Check all EdLight contact sources for today's birthdays: the Google Workspace Contacts directory (People API), all Google Sheets from Google Forms that contain a birthday column (auto-discovered from Drive — covers ESLP application sheets, alumni surveys, etc.), and an optional fixed contacts spreadsheet. Drafts personalised birthday messages per contact type (general, ESLP applicant not selected, current member/fellow, ESLP alumni) and sends a WhatsApp alert to the admin. Use when asked 'Who has a birthday today?', 'Check birthdays', or 'Wish happy birthday to our contacts'.",
  parameters: {
    type: 'object',
    properties: {
      spreadsheetId: {
        type: 'string',
        description: 'Fixed contacts sheet ID (optional — also uses BIRTHDAY_CONTACTS_SHEET_ID env var)',
      },
      sheetRange: {
        type: 'string',
        description: 'A1 range for the fixed sheet (default "Contacts!A:G")',
        default: 'Contacts!A:G',
      },
      adminPhone: {
        type: 'string',
        description: 'Admin WhatsApp number to notify (no +). Uses BIRTHDAY_ADMIN_PHONE env var if omitted.',
      },
      sources: {
        type: 'array',
        items: { type: 'string', enum: ['contacts', 'forms', 'sheet'] },
        description: 'Which sources to check. Defaults to all: ["contacts","forms","sheet"]',
      },
      dryRun: {
        type: 'boolean',
        description: 'Return results without sending WhatsApp (default false)',
        default: false,
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['contacts:read', 'whatsapp:send'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params  = inputSchema.parse(input);
    const userId  = context.userId;

    if (!userId) return { success: false, data: null, error: 'Authentication required.' };

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'Your account is not linked to a Google Workspace tenant.' };
    }

    const adminPhone = params.adminPhone ?? env.BIRTHDAY_ADMIN_PHONE;
    const dryRun     = params.dryRun ?? false;

    if (!dryRun && !adminPhone) {
      return {
        success: false,
        data: null,
        error: 'No admin phone configured. Pass adminPhone or set BIRTHDAY_ADMIN_PHONE env var.',
      };
    }

    try {
      const result = await scanBirthdays({
        tenantId,
        sources: params.sources ?? undefined,
        spreadsheetId: params.spreadsheetId,
        sheetRange: params.sheetRange,
      });

      // ── Audit log ───────────────────────────────────────────────────────
      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action:    'data_access',
        resource:  'checkBirthdays',
        details:   { today: result.today, sources: params.sources ?? ['contacts', 'forms', 'sheet'], totalFound: result.count, sourceLog: result.sourceLog },
        success:   true,
      }).catch(() => {});

      // ── No birthdays today ──────────────────────────────────────────────
      if (result.count === 0) {
        return {
          success: true,
          data: {
            today: result.today,
            count: 0,
            sourceLog: result.sourceLog,
            message: `No birthdays today (${result.dateLabel}) across all checked sources.`,
            birthdays: [],
          },
        };
      }

      // ── Send WhatsApp ───────────────────────────────────────────────────
      let whatsappMessageId: string | null = null;
      let whatsappError: string | null     = null;

      if (!dryRun && adminPhone) {
        try {
          whatsappMessageId = await sendWhatsAppAlert(adminPhone, result.alertText);
          await logAuditEvent({
            userId,
            sessionId: context.sessionId,
            action:    'admin_action',
            resource:  'checkBirthdays:whatsapp_alert',
            details:   { adminPhone, birthdayCount: result.count, messageId: whatsappMessageId },
            success:   true,
          }).catch(() => {});
        } catch (err) {
          whatsappError = err instanceof Error ? err.message : String(err);
        }
      }

      return {
        success: true,
        data: {
          today: result.today,
          dateLabel: result.dateLabel,
          count: result.count,
          sourceLog: result.sourceLog,
          message: dryRun
            ? `Found ${result.count} birthday${result.count === 1 ? '' : 's'} today (dry run — WhatsApp not sent).`
            : whatsappError
              ? `Found ${result.count} birthday${result.count === 1 ? '' : 's'} today, but the WhatsApp alert failed: ${whatsappError}`
              : `Found ${result.count} birthday${result.count === 1 ? '' : 's'} today. WhatsApp alert sent to ${adminPhone}! 🎂`,
          whatsappMessageId,
          whatsappError,
          alertText: result.alertText,
          birthdays: result.birthdays,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: `Birthday scan failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

toolRegistry.register(checkBirthdays);
export default checkBirthdays;
