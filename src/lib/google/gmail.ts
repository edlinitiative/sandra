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

// ─── List / Read / Reply ──────────────────────────────────────────────────────

export interface GmailListOptions {
  /** Gmail search query (same syntax as the Gmail search box) */
  q?: string;
  /** Max messages to return (default 10, max 50) */
  maxResults?: number;
  /** Label IDs to filter by (e.g. ['INBOX', 'UNREAD']) */
  labelIds?: string[];
}

export interface GmailMessage {
  messageId: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  /** Short preview text */
  snippet: string;
  /** Full plain-text body (truncated to 4000 chars) */
  body?: string;
  date: string;
  labelIds: string[];
}

export interface GmailReplyInput {
  /** The address sending the reply (must be a domain user under DWD) */
  from: string;
  threadId: string;
  /** Message-ID header of the message being replied to */
  inReplyToMessageId: string;
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function decodeBase64url(encoded: string): string {
  const s = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(s, 'base64').toString('utf-8');
}

function extractHeader(
  headers: Array<{ name: string; value: string }>,
  name: string,
): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function extractBody(payload: Record<string, unknown>): string {
  // Inline body
  const bodyData = (payload.body as Record<string, unknown> | undefined)?.data as string | undefined;
  if (bodyData) return decodeBase64url(bodyData);

  // Multipart — prefer text/plain part
  const parts = (payload.parts as Array<Record<string, unknown>> | undefined) ?? [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain') {
      const partData = (part.body as Record<string, unknown> | undefined)?.data as string | undefined;
      if (partData) return decodeBase64url(partData);
    }
  }
  // Fall back to first part
  const firstPart = parts[0];
  if (firstPart) {
    const partData = (firstPart.body as Record<string, unknown> | undefined)?.data as string | undefined;
    if (partData) return decodeBase64url(partData);
  }
  return '';
}

// ─── Public API (list / read / reply) ────────────────────────────────────────

/**
 * List recent Gmail messages matching an optional query.
 */
export async function listMessages(
  ctx: GoogleWorkspaceContext,
  options: GmailListOptions = {},
): Promise<GmailMessage[]> {
  log.info('Listing Gmail messages', { q: options.q, tenantId: ctx.tenantId });

  const userCtx: GoogleWorkspaceContext = { ...ctx, impersonateEmail: ctx.impersonateEmail };
  const token = await getContextToken(userCtx, [GOOGLE_SCOPES.GMAIL_READONLY]);

  const maxResults = Math.min(options.maxResults ?? 10, 50);
  const url = new URL(`${GMAIL_API}/users/me/messages`);
  url.searchParams.set('maxResults', String(maxResults));
  if (options.q) url.searchParams.set('q', options.q);
  if (options.labelIds?.length) {
    for (const label of options.labelIds) url.searchParams.append('labelIds', label);
  }

  const listRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) {
    const body = await listRes.text();
    throw new Error(`Gmail list failed: ${listRes.status} — ${body}`);
  }

  const listData = (await listRes.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
  };
  const stubs = listData.messages ?? [];
  if (stubs.length === 0) return [];

  // Batch fetch message details (format=metadata for speed, format=full for body)
  const messages: GmailMessage[] = [];
  for (const stub of stubs.slice(0, maxResults)) {
    try {
      const msgUrl = `${GMAIL_API}/users/me/messages/${stub.id}?format=full`;
      const msgRes = await fetch(msgUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!msgRes.ok) continue;

      const msg = (await msgRes.json()) as {
        id: string;
        threadId: string;
        snippet: string;
        labelIds: string[];
        internalDate: string;
        payload: {
          headers: Array<{ name: string; value: string }>;
          mimeType: string;
          body: { data?: string };
          parts?: Array<Record<string, unknown>>;
        };
      };

      const headers = msg.payload.headers;
      const from = extractHeader(headers, 'From');
      const toRaw = extractHeader(headers, 'To');
      const subject = extractHeader(headers, 'Subject');
      const date = extractHeader(headers, 'Date') || new Date(Number(msg.internalDate)).toUTCString();
      const body = extractBody(msg.payload as Record<string, unknown>).slice(0, 4000);

      messages.push({
        messageId: msg.id,
        threadId: msg.threadId,
        from,
        to: toRaw.split(',').map((s) => s.trim()).filter(Boolean),
        subject,
        snippet: msg.snippet,
        body: body || undefined,
        date,
        labelIds: msg.labelIds ?? [],
      });
    } catch {
      // Skip messages that fail to parse
    }
  }

  return messages;
}

/**
 * Get a single Gmail message by ID.
 */
export async function getMessage(
  ctx: GoogleWorkspaceContext,
  messageId: string,
): Promise<GmailMessage> {
  log.info('Getting Gmail message', { messageId, tenantId: ctx.tenantId });

  const token = await getContextToken(ctx, [GOOGLE_SCOPES.GMAIL_READONLY]);
  const res = await fetch(`${GMAIL_API}/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail getMessage failed: ${res.status} — ${body}`);
  }

  const msg = (await res.json()) as {
    id: string;
    threadId: string;
    snippet: string;
    labelIds: string[];
    internalDate: string;
    payload: {
      headers: Array<{ name: string; value: string }>;
      body: { data?: string };
      parts?: Array<Record<string, unknown>>;
    };
  };

  const headers = msg.payload.headers;
  const body = extractBody(msg.payload as Record<string, unknown>).slice(0, 4000);

  return {
    messageId: msg.id,
    threadId: msg.threadId,
    from: extractHeader(headers, 'From'),
    to: extractHeader(headers, 'To').split(',').map((s) => s.trim()).filter(Boolean),
    subject: extractHeader(headers, 'Subject'),
    snippet: msg.snippet,
    body: body || undefined,
    date: extractHeader(headers, 'Date') || new Date(Number(msg.internalDate)).toUTCString(),
    labelIds: msg.labelIds ?? [],
  };
}

/**
 * Reply to a Gmail thread.
 */
export async function replyToMessage(
  ctx: GoogleWorkspaceContext,
  input: GmailReplyInput,
): Promise<GmailSendResult> {
  log.info('Replying to Gmail thread', {
    from: input.from,
    threadId: input.threadId,
    tenantId: ctx.tenantId,
  });

  const senderCtx: GoogleWorkspaceContext = { ...ctx, impersonateEmail: input.from };
  const token = await getContextToken(senderCtx, GMAIL_SEND_SCOPES);

  // Build reply-aware RFC 2822 message
  const lines: string[] = [];
  lines.push(`From: ${input.from}`);
  lines.push(`To: ${input.to.join(', ')}`);
  if (input.cc?.length) lines.push(`Cc: ${input.cc.join(', ')}`);
  lines.push(`Subject: ${input.subject}`);
  lines.push(`In-Reply-To: <${input.inReplyToMessageId}>`);
  lines.push(`References: <${input.inReplyToMessageId}>`);
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Content-Type: text/plain; charset=UTF-8`);
  lines.push('');
  lines.push(input.body);

  const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

  const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw, threadId: input.threadId }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail reply failed: ${res.status} — ${body}`);
  }

  const data = (await res.json()) as { id: string; threadId: string; labelIds: string[] };
  log.info('Reply sent', { messageId: data.id, threadId: data.threadId });
  return { messageId: data.id, threadId: data.threadId, labelIds: data.labelIds ?? [] };
}

/**
 * Mark a Gmail message as read by removing the UNREAD label.
 */
export async function markAsRead(
  ctx: GoogleWorkspaceContext,
  messageId: string,
): Promise<void> {
  const token = await getContextToken(ctx, [GOOGLE_SCOPES.GMAIL_MODIFY]);

  const res = await fetch(`${GMAIL_API}/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail markAsRead failed: ${res.status} — ${body}`);
  }

  log.info('Message marked as read', { messageId });
}
