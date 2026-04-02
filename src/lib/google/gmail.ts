/**
 * Google Gmail — send and draft emails via Gmail API.
 *
 * Uses domain-wide delegation to impersonate the sender.
 * All sends go through the action queue with human-in-the-loop approval
 * (enforced at the tool layer, not here).
 *
 * Resend remains the system/platform email transport.
 * Gmail API is ONLY for real mailbox actions on behalf of domain users.
 */

import { createLogger } from '@/lib/utils';
import { getContextToken, GOOGLE_SCOPES } from './auth';
import type { GoogleWorkspaceContext, GmailDraftInput, GmailSendResult } from './types';

const log = createLogger('google:gmail');

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const GMAIL_SEND_SCOPES = [GOOGLE_SCOPES.GMAIL_SEND];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a RFC 2822 compliant email message (raw format).
 */
function buildRawMessage(input: GmailDraftInput): string {
  const lines: string[] = [];
  lines.push(`From: ${input.from}`);
  lines.push(`To: ${input.to.join(', ')}`);
  if (input.cc?.length) lines.push(`Cc: ${input.cc.join(', ')}`);
  if (input.bcc?.length) lines.push(`Bcc: ${input.bcc.join(', ')}`);
  lines.push(`Subject: ${input.subject}`);
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push(`MIME-Version: 1.0`);

  if (input.isHtml) {
    lines.push(`Content-Type: text/html; charset=UTF-8`);
  } else {
    lines.push(`Content-Type: text/plain; charset=UTF-8`);
  }

  lines.push(''); // blank line before body
  lines.push(input.body);

  return lines.join('\r\n');
}

/**
 * Base64url-encode a raw RFC 2822 message for the Gmail API.
 */
function encodeMessage(raw: string): string {
  return Buffer.from(raw).toString('base64url');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Send an email via Gmail API (impersonating the sender).
 *
 * The `from` address in `input` must be a user in the Workspace domain
 * for which the service account has delegation authority.
 */
export async function sendEmail(
  ctx: GoogleWorkspaceContext,
  input: GmailDraftInput,
): Promise<GmailSendResult> {
  log.info('Sending email via Gmail API', {
    from: input.from,
    to: input.to,
    subject: input.subject,
    tenantId: ctx.tenantId,
  });

  // Impersonate the sender
  const senderCtx: GoogleWorkspaceContext = {
    ...ctx,
    impersonateEmail: input.from,
  };

  const token = await getContextToken(senderCtx, GMAIL_SEND_SCOPES);
  const raw = encodeMessage(buildRawMessage(input));

  const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const body = await res.text();
    log.error('Gmail send failed', { status: res.status, body });
    throw new Error(`Gmail send failed: ${res.status} — ${body}`);
  }

  const data = (await res.json()) as { id: string; threadId: string; labelIds: string[] };

  log.info('Email sent', { messageId: data.id, threadId: data.threadId });
  return {
    messageId: data.id,
    threadId: data.threadId,
    labelIds: data.labelIds ?? [],
  };
}

/**
 * Create a draft in the sender's mailbox (without sending).
 */
export async function createDraft(
  ctx: GoogleWorkspaceContext,
  input: GmailDraftInput,
): Promise<{ draftId: string; message: GmailSendResult }> {
  log.info('Creating Gmail draft', {
    from: input.from,
    to: input.to,
    subject: input.subject,
    tenantId: ctx.tenantId,
  });

  const senderCtx: GoogleWorkspaceContext = {
    ...ctx,
    impersonateEmail: input.from,
  };

  const token = await getContextToken(senderCtx, [GOOGLE_SCOPES.GMAIL_COMPOSE]);
  const raw = encodeMessage(buildRawMessage(input));

  const res = await fetch(`${GMAIL_API}/users/me/drafts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
  });

  if (!res.ok) {
    const body = await res.text();
    log.error('Gmail draft failed', { status: res.status, body });
    throw new Error(`Gmail draft creation failed: ${res.status} — ${body}`);
  }

  const data = (await res.json()) as {
    id: string;
    message: { id: string; threadId: string; labelIds: string[] };
  };

  log.info('Draft created', { draftId: data.id });
  return {
    draftId: data.id,
    message: {
      messageId: data.message.id,
      threadId: data.message.threadId,
      labelIds: data.message.labelIds ?? [],
    },
  };
}
