import type { ChannelAdapter, InboundMessage, OutboundMessage } from './types';
import { buildEmailBody } from './email-formatter';
import { env } from '@/lib/config';
import { createLogger } from '@/lib/utils';
import type { GmailMessage } from '@/lib/google/gmail';
import { sendEmail, replyToMessage } from '@/lib/google/gmail';
import { resolveGoogleContext } from '@/lib/google/context';

const log = createLogger('channels:email');

// ─── Email payload types ─────────────────────────────────────────────────────

/** Normalised inbound email — used when parsing raw webhook form-data payloads. */
export interface InboundEmail {
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  text: string;
  html?: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * Email channel adapter — sends and receives via Gmail API (Google Workspace).
 *
 * Inbound:  Gmail API polling in /api/cron/email-poll (listMessages + mark-read).
 *           The parseInbound() method is kept for raw-form-data compatibility only.
 * Outbound: Gmail API sendEmail() / replyToMessage() — zero third-party dependencies.
 */
export class EmailChannelAdapter implements ChannelAdapter {
  readonly channelType = 'email' as const;

  /** Returns the Sandra inbox address from env, or a sensible default. */
  get sandraEmail(): string {
    return env.SANDRA_EMAIL_ADDRESS ?? `sandra@${env.GOOGLE_WORKSPACE_DOMAIN ?? 'edlight.org'}`;
  }

  isConfigured(): boolean {
    // Production: credentials live in ConnectedProvider DB row (loaded via resolveGoogleContext)
    // Dev / env-only: GOOGLE_SA_JSON or individual GOOGLE_SERVICE_ACCOUNT_* vars
    return Boolean(
      env.GOOGLE_SA_JSON ||
      (env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_KEY),
    );
  }

  /**
   * Parse a raw form-data payload (legacy / testing) into a normalised InboundMessage.
   *
   * Used by /api/webhooks/email if someone posts raw email fields.
   * The primary inbound path is the email-poll cron which calls processGmailMessage().
   */
  async parseInbound(rawPayload: unknown): Promise<InboundMessage> {
    const payload = rawPayload as Record<string, string>;

    const from = payload['from'] ?? '';
    const subject = payload['subject'] ?? '(no subject)';
    const text = payload['text'] ?? payload['html'] ?? '';
    const messageId = payload['headers']
      ? this._extractHeader(payload['headers'], 'Message-ID') ?? crypto.randomUUID()
      : (payload['message-id'] ?? crypto.randomUUID());

    if (!from) {
      throw new Error('Inbound email missing sender address');
    }

    const { address: fromAddress, name: fromName } = this._parseEmailAddress(from);

    // Combine subject + body so Sandra has full context
    const content = subject && !subject.startsWith('Re:')
      ? `Subject: ${subject}\n\n${text.trim()}`
      : text.trim();

    if (!content) {
      throw new Error('SKIP: Empty email body');
    }

    return {
      channelType: 'email',
      channelUserId: fromAddress,
      content,
      timestamp: new Date(),
      metadata: {
        emailMessageId: messageId,
        subject,
        fromName,
        to: payload['to'] ?? this.sandraEmail,
        inReplyTo: payload['in-reply-to'] ?? null,
      },
    };
  }

  /**
   * Convert a GmailMessage (from Gmail API polling) into a normalised InboundMessage.
   */
  parseGmailMessage(msg: GmailMessage): InboundMessage {
    const { address: fromAddress, name: fromName } = this._parseEmailAddress(msg.from);
    const subject = msg.subject ?? '(no subject)';

    const content = subject && !subject.startsWith('Re:')
      ? `Subject: ${subject}\n\n${(msg.body ?? msg.snippet).trim()}`
      : (msg.body ?? msg.snippet).trim();

    if (!content) {
      throw new Error('SKIP: Empty Gmail message body');
    }

    return {
      channelType: 'email',
      channelUserId: fromAddress,
      content,
      timestamp: new Date(msg.date),
      metadata: {
        emailMessageId: msg.messageId,
        gmailThreadId: msg.threadId,
        subject,
        fromName,
        to: this.sandraEmail,
        inReplyTo: null,
      },
    };
  }

  /**
   * Format an outbound message into a Gmail-ready payload object.
   */
  async formatOutbound(message: OutboundMessage): Promise<Record<string, unknown>> {
    const subject = (message.metadata?.subject as string | undefined)
      ? `Re: ${message.metadata!.subject as string}`
      : 'Sandra — EdLight';
    return {
      from: this.sandraEmail,
      to: message.recipientId,
      subject,
      body: buildEmailBody({ response: message.content }),
      threadId: message.metadata?.gmailThreadId ?? null,
      inReplyToMessageId: message.metadata?.emailMessageId ?? null,
    };
  }

  /**
   * Send a reply to an existing Gmail thread, or a fresh email if no thread exists.
   */
  async send(message: OutboundMessage): Promise<void> {
    const subject = (message.metadata?.subject as string | undefined)
      ? `Re: ${message.metadata!.subject as string}`
      : 'Sandra — EdLight';
    const textBody = buildEmailBody({ response: message.content });
    const threadId = message.metadata?.gmailThreadId as string | undefined;
    const inReplyToMessageId = message.metadata?.emailMessageId as string | undefined;

    if (!env.DEFAULT_TENANT_ID) {
      throw new Error('DEFAULT_TENANT_ID not configured — cannot send email');
    }
    const ctx = await resolveGoogleContext(env.DEFAULT_TENANT_ID, this.sandraEmail);

    if (threadId && inReplyToMessageId) {
      await replyToMessage(ctx, {
        from: this.sandraEmail,
        threadId,
        inReplyToMessageId,
        to: [message.recipientId],
        subject,
        body: textBody,
      });
    } else {
      await sendEmail(ctx, {
        from: this.sandraEmail,
        to: [message.recipientId],
        subject,
        body: textBody,
        isHtml: false,
      });
    }

    log.info('Email sent via Gmail API', { to: message.recipientId.slice(0, 6) + '****' });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private _parseEmailAddress(raw: string): { address: string; name: string | null } {
    const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
    if (match) {
      return { name: match[1]?.trim() || null, address: match[2]!.trim().toLowerCase() };
    }
    return { name: null, address: raw.trim().toLowerCase() };
  }

  private _extractHeader(headersRaw: string, headerName: string): string | null {
    const lines = headersRaw.split('\n');
    for (const line of lines) {
      const [key, ...rest] = line.split(':');
      if (key?.trim().toLowerCase() === headerName.toLowerCase()) {
        return rest.join(':').trim();
      }
    }
    return null;
  }
}

let _adapter: EmailChannelAdapter | null = null;

export function getEmailAdapter(): EmailChannelAdapter {
  if (!_adapter) _adapter = new EmailChannelAdapter();
  return _adapter;
}
