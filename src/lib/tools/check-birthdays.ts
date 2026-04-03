/**
 * checkBirthdays — scan the EdLight contacts Google Sheet for today's birthdays,
 * draft a personalised happy-birthday message per contact type, and send a
 * WhatsApp alert to the configured admin phone number.
 *
 * Contact types supported:
 *   - general          : general contacts / supporters
 *   - eslp_rejected    : people who applied to ESLP but didn't make the cohort
 *   - current_member   : active ESLP / program participants
 *   - eslp_alumni      : ESLP graduates
 *
 * Expected Google Sheet columns (first row = header, case-insensitive):
 *   Name | Email | Phone | Birthday | Type | Notes
 *
 * Birthday format: MM-DD  (e.g. "04-03" for April 3).
 * Also accepts: MM/DD, YYYY-MM-DD (ISO), or a written month name like "April 3".
 *
 * Required scopes: contacts:read, whatsapp:send
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { readSheetRows } from '@/lib/google/drive';
import { logAuditEvent } from '@/lib/audit';
import { env } from '@/lib/config';

// ─── Types ───────────────────────────────────────────────────────────────────

type ContactType = 'general' | 'eslp_rejected' | 'current_member' | 'eslp_alumni';

interface ContactRow {
  name: string;
  email: string;
  phone: string;
  /** Normalised to MM-DD, e.g. "04-03" */
  birthday: string;
  contactType: ContactType;
  notes: string;
}

interface BirthdayHit {
  contact: ContactRow;
  draftMessage: string;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const inputSchema = z.object({
  spreadsheetId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Google Sheets file ID for the contacts list. Falls back to the BIRTHDAY_CONTACTS_SHEET_ID env var.',
    ),
  sheetRange: z
    .string()
    .optional()
    .default('Contacts!A:G')
    .describe('A1-notation range to read, e.g. "Contacts!A:G". Default: "Contacts!A:G"'),
  adminPhone: z
    .string()
    .optional()
    .describe(
      "Admin phone number to notify via WhatsApp (international format, no +). Falls back to BIRTHDAY_ADMIN_PHONE env var.",
    ),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, return the birthday list and drafted messages without sending a WhatsApp.'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Month name → zero-padded 2-digit month number */
const MONTH_NAME_MAP: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Parse a birthday string into MM-DD format.
 * Accepts:
 *   - "MM-DD"       → "04-03"
 *   - "MM/DD"       → "04/03"
 *   - "YYYY-MM-DD"  → extracts MM-DD
 *   - "April 3"     → "04-03"
 *   - "3 April"     → "04-03"
 */
function parseBirthday(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO: YYYY-MM-DD
  const iso = s.match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return `${iso[1].padStart(2, '0')}-${iso[2].padStart(2, '0')}`;
  }

  // MM-DD or MM/DD
  const mmdd = s.match(/^(\d{1,2})[-\/](\d{1,2})$/);
  if (mmdd) {
    const m = Number(mmdd[1]);
    const d = Number(mmdd[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // "April 3" or "April 03"
  const nameDay = s.match(/^([a-zA-Z]+)\s+(\d{1,2})$/);
  if (nameDay) {
    const monthKey = nameDay[1].toLowerCase();
    const month = MONTH_NAME_MAP[monthKey];
    if (month) {
      return `${month}-${nameDay[2].padStart(2, '0')}`;
    }
  }

  // "3 April" or "03 April"
  const dayName = s.match(/^(\d{1,2})\s+([a-zA-Z]+)$/);
  if (dayName) {
    const monthKey = dayName[2].toLowerCase();
    const month = MONTH_NAME_MAP[monthKey];
    if (month) {
      return `${month}-${dayName[1].padStart(2, '0')}`;
    }
  }

  return null;
}

/** Get today's birthday key in MM-DD format. */
function todayMMDD(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

/** Map raw contact type string → ContactType (with fallback to 'general'). */
function parseContactType(raw: string): ContactType {
  const s = raw.trim().toLowerCase().replace(/[\s-]/g, '_');
  if (s.includes('rejected') || s.includes('applicant') || s.includes('not_accepted')) return 'eslp_rejected';
  if (s.includes('alumni') || s.includes('alum') || s.includes('graduate')) return 'eslp_alumni';
  if (s.includes('member') || s.includes('fellow') || s.includes('current') || s.includes('active')) return 'current_member';
  return 'general';
}

/** Readable label per contact type (for the WhatsApp alert). */
function contactTypeLabel(t: ContactType): string {
  switch (t) {
    case 'eslp_rejected':   return 'ESLP Applicant (not selected)';
    case 'current_member':  return 'Current Member / Fellow';
    case 'eslp_alumni':     return 'ESLP Alum 🎓';
    case 'general':
    default:                return 'General Contact';
  }
}

/**
 * Draft a personalised birthday message based on the contact's relationship
 * to EdLight. Messages are warm, concise, and ready to copy-paste.
 */
function draftBirthdayMessage(contact: ContactRow): string {
  const { name, contactType, notes } = contact;
  const firstName = name.split(' ')[0];

  switch (contactType) {
    case 'current_member':
      return (
        `🎂 Happy Birthday, ${firstName}! 🎉\n\n` +
        `The entire EdLight family is celebrating YOU today! As an active member of our community, ` +
        `you inspire us every single day. We're proud to have you with us and can't wait to see everything ` +
        `you'll accomplish. Wishing you an amazing birthday filled with joy, laughter, and everything you deserve! 🌟\n\n` +
        `With love,\nThe EdLight Team`
      );

    case 'eslp_alumni':
      return (
        `🎂 Happy Birthday, ${firstName} — ESLP Alum! 🎓🎂\n\n` +
        `Once a fellow, always a fellow! The EdLight family never forgets, and today we're celebrating YOU. ` +
        `Your ESLP journey was just the beginning — we are so proud of who you've become and how far you've come since then. ` +
        `Wishing you an incredible birthday surrounded by people who love and appreciate you. ✨\n\n` +
        `With pride and joy,\nThe EdLight Team`
      );

    case 'eslp_rejected':
      return (
        `🎂 Happy Birthday, ${firstName}! 🎉\n\n` +
        `The EdLight team is thinking of you on your special day and wishing you all the happiness in the world! ` +
        `Your ambition and passion for growth inspire us, and we're so glad you're part of our extended family. ` +
        `We hope this birthday marks the start of an extraordinary new chapter for you. Keep shining! 🌟\n\n` +
        `Warm wishes,\nEdLight Initiative`
      );

    case 'general':
    default:
      return (
        `🎂 Happy Birthday, ${firstName}! 🎉\n\n` +
        `On behalf of the entire EdLight team, we're wishing you a wonderful birthday filled with joy and celebration. ` +
        `You mean a lot to our community, and we hope this special day brings you everything you deserve. ` +
        `Have an amazing one! 🌟\n\n` +
        (notes ? `P.S. ${notes}\n\n` : '') +
        `Warm regards,\nEdLight Initiative`
      );
  }
}

/** Send a WhatsApp message using the Meta Cloud API. */
async function sendWhatsAppAlert(to: string, message: string): Promise<string> {
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion    = env.WHATSAPP_API_VERSION;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp is not configured on this Sandra instance (missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN).');
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
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

/** Parse the sheet header row and return a column-index map. */
function parseHeaders(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const key = headerRow[i].trim().toLowerCase().replace(/[\s_-]+/g, '_');
    map[key] = i;
  }
  return map;
}

/** Resolve a column index by trying multiple synonyms. */
function col(map: Record<string, number>, ...keys: string[]): number {
  for (const k of keys) {
    if (k in map) return map[k];
  }
  return -1;
}

// ─── Tool definition ──────────────────────────────────────────────────────────

const checkBirthdays: SandraTool = {
  name: 'checkBirthdays',
  description:
    "Check the EdLight contacts Google Sheet for today's birthdays. For each birthday contact (general contacts, ESLP applicants who weren't selected, current members/fellows, and ESLP alumni), drafts a warm, personalised birthday message and sends a WhatsApp alert to the admin team. Use this when asked 'Who has a birthday today?', 'Check for birthdays', or 'Did anyone in our contacts have a birthday today?'.",
  parameters: {
    type: 'object',
    properties: {
      spreadsheetId: {
        type: 'string',
        description: 'Google Sheets file ID for the contacts list (optional — uses BIRTHDAY_CONTACTS_SHEET_ID env var if omitted)',
      },
      sheetRange: {
        type: 'string',
        description: 'A1-notation range to read, e.g. "Contacts!A:G". Default: "Contacts!A:G"',
        default: 'Contacts!A:G',
      },
      adminPhone: {
        type: 'string',
        description: 'Admin phone to notify via WhatsApp (international format, no +). Uses BIRTHDAY_ADMIN_PHONE env var if omitted.',
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, return birthdays and drafted messages without sending WhatsApp.',
        default: false,
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['contacts:read', 'whatsapp:send'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to check birthdays.' };
    }

    // ── Resolve spreadsheet ID ───────────────────────────────────────────────
    const spreadsheetId = params.spreadsheetId ?? env.BIRTHDAY_CONTACTS_SHEET_ID;
    if (!spreadsheetId) {
      return {
        success: false,
        data: null,
        error:
          'No contacts spreadsheet configured. Pass spreadsheetId or set the BIRTHDAY_CONTACTS_SHEET_ID environment variable.',
      };
    }

    // ── Resolve admin phone ──────────────────────────────────────────────────
    const adminPhone = params.adminPhone ?? env.BIRTHDAY_ADMIN_PHONE;
    const dryRun     = params.dryRun ?? false;

    if (!dryRun && !adminPhone) {
      return {
        success: false,
        data: null,
        error:
          'No admin phone number configured. Pass adminPhone or set the BIRTHDAY_ADMIN_PHONE environment variable.',
      };
    }

    // ── Resolve Google Workspace context ─────────────────────────────────────
    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return {
        success: false,
        data: null,
        error: 'Your account is not linked to a Google Workspace tenant.',
      };
    }

    let rows: string[][];
    try {
      const rawCtx = await resolveGoogleContext(tenantId);
      // Use the drive impersonation email so the service account can read the sheet.
      const ctx = rawCtx.config?.driveImpersonateEmail
        ? { ...rawCtx, impersonateEmail: rawCtx.config.driveImpersonateEmail as string }
        : rawCtx;

      rows = await readSheetRows(ctx, spreadsheetId, params.sheetRange ?? 'Contacts!A:G');
    } catch (err) {
      return {
        success: false,
        data: null,
        error: `Could not read the contacts sheet: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (rows.length < 2) {
      return {
        success: true,
        data: { message: 'The contacts sheet appears to be empty or has only a header row.', birthdays: [] },
      };
    }

    // ── Parse headers ────────────────────────────────────────────────────────
    const headerMap = parseHeaders(rows[0]);
    const iName    = col(headerMap, 'name', 'full_name', 'fullname', 'contact_name');
    const iEmail   = col(headerMap, 'email', 'email_address');
    const iPhone   = col(headerMap, 'phone', 'phone_number', 'whatsapp', 'mobile');
    const iBday    = col(headerMap, 'birthday', 'birth_date', 'birthdate', 'date_of_birth', 'dob');
    const iType    = col(headerMap, 'type', 'contact_type', 'category', 'role', 'relationship');
    const iNotes   = col(headerMap, 'notes', 'note', 'comment', 'comments');

    if (iName === -1 || iBday === -1) {
      return {
        success: false,
        data: null,
        error: `Could not find required columns (Name, Birthday) in the sheet. Found headers: ${rows[0].join(', ')}`,
      };
    }

    // ── Find today's birthdays ────────────────────────────────────────────────
    const today = todayMMDD();
    const hits: BirthdayHit[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const rawBday = row[iBday]?.trim() ?? '';
      if (!rawBday) continue;

      const normalized = parseBirthday(rawBday);
      if (normalized !== today) continue;

      const contact: ContactRow = {
        name:        row[iName]?.trim()  ?? `Row ${r + 1}`,
        email:       iEmail  >= 0 ? (row[iEmail]?.trim()  ?? '') : '',
        phone:       iPhone  >= 0 ? (row[iPhone]?.trim()  ?? '') : '',
        birthday:    normalized,
        contactType: iType >= 0 ? parseContactType(row[iType] ?? '') : 'general',
        notes:       iNotes  >= 0 ? (row[iNotes]?.trim()  ?? '') : '',
      };

      hits.push({ contact, draftMessage: draftBirthdayMessage(contact) });
    }

    // ── Audit the read ────────────────────────────────────────────────────────
    await logAuditEvent({
      userId,
      sessionId: context.sessionId,
      action:    'data_access',
      resource:  'checkBirthdays',
      details:   { spreadsheetId, today, birthdayCount: hits.length },
      success:   true,
    }).catch(() => {});

    // ── No birthdays today ────────────────────────────────────────────────────
    if (hits.length === 0) {
      return {
        success: true,
        data: {
          message: `No birthdays today (${today}) in the contacts list.`,
          birthdays: [],
          today,
        },
      };
    }

    // ── Build WhatsApp alert ──────────────────────────────────────────────────
    const dateLabel = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    const alertLines: string[] = [
      `🎂 *Birthday Alert — ${dateLabel}*\n`,
      `${hits.length} birthday${hits.length === 1 ? '' : 's'} in your EdLight contacts today:\n`,
    ];

    for (let i = 0; i < hits.length; i++) {
      const { contact, draftMessage } = hits[i];
      alertLines.push(
        `*${i + 1}. ${contact.name}* — ${contactTypeLabel(contact.contactType)}`,
        contact.email ? `📧 ${contact.email}` : '',
        contact.phone ? `📱 ${contact.phone}` : '',
        `\n💬 *Suggested message:*\n${draftMessage}`,
        '', // blank line separator
      );
    }

    alertLines.push('— Sandra | EdLight AI');
    const alertText = alertLines.filter((l) => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();

    // ── Send WhatsApp (unless dry run) ────────────────────────────────────────
    let whatsappMessageId: string | null = null;
    let whatsappError: string | null     = null;

    if (!dryRun && adminPhone) {
      try {
        whatsappMessageId = await sendWhatsAppAlert(adminPhone, alertText);
        await logAuditEvent({
          userId,
          sessionId: context.sessionId,
          action:    'admin_action',
          resource:  'checkBirthdays:whatsapp_alert',
          details:   { adminPhone, birthdayCount: hits.length, messageId: whatsappMessageId },
          success:   true,
        }).catch(() => {});
      } catch (err) {
        whatsappError = err instanceof Error ? err.message : String(err);
      }
    }

    // ── Return structured result ──────────────────────────────────────────────
    return {
      success: true,
      data: {
        today,
        count:   hits.length,
        message: dryRun
          ? `Found ${hits.length} birthday${hits.length === 1 ? '' : 's'} today (dry run — no WhatsApp sent).`
          : whatsappError
            ? `Found ${hits.length} birthday${hits.length === 1 ? '' : 's'} today, but the WhatsApp alert failed: ${whatsappError}`
            : `Found ${hits.length} birthday${hits.length === 1 ? '' : 's'} today. WhatsApp alert sent! 🎂`,
        whatsappMessageId,
        whatsappError,
        alertText,
        birthdays: hits.map(({ contact, draftMessage }) => ({
          name:        contact.name,
          email:       contact.email,
          phone:       contact.phone,
          contactType: contact.contactType,
          contactTypeLabel: contactTypeLabel(contact.contactType),
          notes:       contact.notes,
          draftMessage,
        })),
      },
    };
  },
};

toolRegistry.register(checkBirthdays);
export default checkBirthdays;
