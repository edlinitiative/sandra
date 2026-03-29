import type { ChannelAdapter, InboundMessage, OutboundMessage } from './types';
import { buildEmailBody } from './email-formatter';
import { env } from '@/lib/config';
import { createLogger } from '@/lib/utils';

const log = createLogger('channels:email');

// ─── Email payload types ─────────────────────────────────────────────────────

/** Normalised inbound email parsed from SendGrid Inbound Parse webhook. */
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

/** SendGrid /v3/mail/send payload (minimal) */
interface SendGridMailBody {
  personalizations: Array<{ to: Array<{ email: string; name?: string }> }>;
  from: { email: string; name: string };
  subject: string;
  content: Array<{ type: string; value: string }>;
  reply_to_list?: Array<{ email: string }>;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * Email channel adapter using SendGrid.
 * Inbound: SendGrid Inbound Parse webhook → normalised InboundMessage.
 * Outbound: SendGrid Mail API /v3/mail/send.
 */
export class EmailChannelAdapter implements ChannelAdapter {
  readonly channelType = 'email' as const;

  private get apiBase(): string {
    return 'https://api.sendgrid.com/v3';
  }

  private get apiKey(): string {
    return env.SENDGRID_API_KEY ?? '';
  }

  isConfigured(): boolean {
    return Boolean(env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL);
  }

  /**
   * Parse a SendGrid Inbound Parse webhook into a normalised InboundMessage.
   *
   * The webhook delivers parsed email fields as form data (key-value pairs).
   * We expect the caller to have already parsed the form body into a plain object.
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
        to: payload['to'] ?? env.SENDGRID_FROM_EMAIL ?? '',
        inReplyTo: payload['in-reply-to'] ?? null,
      },
    };
  }

  /**
   * Format an outbound message as a SendGrid mail body.
   */
  async formatOutbound(message: OutboundMessage): Promise<SendGridMailBody> {
    const subject = (message.metadata?.subject as string | undefined)
      ? `Re: ${message.metadata!.subject as string}`
      : 'Your question to Sandra';

    const textBody = buildEmailBody({ response: message.content });
    const inReplyTo = message.metadata?.inReplyTo as string | undefined;

    const body: SendGridMailBody = {
      personalizations: [{ to: [{ email: message.recipientId }] }],
      from: {
        email: env.SENDGRID_FROM_EMAIL ?? 'sandra@edlight.ht',
        name: env.SENDGRID_FROM_NAME,
      },
      subject,
      content: [{ type: 'text/plain', value: textBody }],
    };

    if (inReplyTo) {
      body.reply_to_list = [{ email: message.recipientId }];
    }

    return body;
  }

  /**
   * Send an email via the SendGrid Mail API.
   */
  async send(message: OutboundMessage): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Email adapter not configured: missing SendGrid credentials');
    }

    const body = await this.formatOutbound(message);
    const url = `${this.apiBase}/mail/send`;

    log.info('Sending email', { to: message.recipientId });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    // SendGrid returns 202 Accepted on success
    if (response.status !== 202 && !response.ok) {
      const errBody = await response.text().catch(() => '');
      log.error('SendGrid send failed', { status: response.status, body: errBody.slice(0, 200) });
      throw new Error(`SendGrid API error: HTTP ${response.status}`);
    }

    log.info('Email sent successfully', { to: message.recipientId });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private _parseEmailAddress(raw: string): { address: string; name: string | null } {
    // Formats: "Name <email@example.com>" or "email@example.com"
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

