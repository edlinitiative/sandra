import type { ChannelAdapter, InboundMessage, OutboundMessage } from './types';
import { formatForWhatsApp } from './whatsapp-formatter';
import { env } from '@/lib/config';
import { createLogger } from '@/lib/utils';

const log = createLogger('channels:whatsapp');

// ─── WhatsApp Cloud API payload types ───────────────────────────────────────

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}

interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

interface WhatsAppValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'button' | 'interactive';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string };
  button?: { text: string; payload: string };
  interactive?: { type: string; button_reply?: { id: string; title: string } };
}

interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

interface WhatsAppOutboundTextBody {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: { preview_url: boolean; body: string };
}

// ─── Adapter ────────────────────────────────────────────────────────────────

/**
 * WhatsApp Cloud API channel adapter.
 * Handles inbound webhook parsing and outbound message delivery.
 */
export class WhatsAppChannelAdapter implements ChannelAdapter {
  readonly channelType = 'whatsapp' as const;

  private get apiBase(): string {
    return `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;
  }

  private get phoneNumberId(): string {
    return env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  }

  private get accessToken(): string {
    return env.WHATSAPP_ACCESS_TOKEN ?? '';
  }

  isConfigured(): boolean {
    return Boolean(
      env.WHATSAPP_PHONE_NUMBER_ID &&
      env.WHATSAPP_ACCESS_TOKEN &&
      env.WHATSAPP_WEBHOOK_SECRET,
    );
  }

  /**
   * Parse a WhatsApp Cloud API webhook payload into a normalised InboundMessage.
   * Throws with message 'SKIP:...' for delivery status updates (not user messages).
   */
  async parseInbound(rawPayload: unknown): Promise<InboundMessage> {
    const payload = rawPayload as WhatsAppWebhookPayload;

    if (payload.object !== 'whatsapp_business_account') {
      throw new Error(`Unexpected webhook object: ${payload.object}`);
    }

    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      throw new Error('Malformed WhatsApp webhook payload: missing value');
    }

    if (!value.messages || value.messages.length === 0) {
      throw new Error('SKIP: No inbound messages in this webhook event');
    }

    const message = value.messages[0]!;
    const contact = value.contacts?.[0];

    let content = '';
    if (message.type === 'text' && message.text?.body) {
      content = message.text.body;
    } else if (message.type === 'button' && message.button?.text) {
      content = message.button.text;
    } else if (message.type === 'interactive' && message.interactive?.button_reply?.title) {
      content = message.interactive.button_reply.title;
    } else {
      content = `[${message.type} message received — I can only process text messages for now]`;
    }

    return {
      channelType: 'whatsapp',
      channelUserId: message.from,
      content,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      metadata: {
        whatsappMessageId: message.id,
        phoneNumberId: value.metadata.phone_number_id,
        displayName: contact?.profile?.name ?? null,
        messageType: message.type,
      },
    };
  }

  /**
   * Format an outbound message as a WhatsApp Cloud API request body.
   */
  async formatOutbound(message: OutboundMessage): Promise<WhatsAppOutboundTextBody> {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.recipientId,
      type: 'text',
      text: { preview_url: false, body: formatForWhatsApp(message.content) },
    };
  }

  /**
   * Send a message via the WhatsApp Cloud API.
   */
  async send(message: OutboundMessage): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp adapter not configured: missing credentials');
    }

    const body = await this.formatOutbound(message);
    const url = `${this.apiBase}/${this.phoneNumberId}/messages`;

    log.info('Sending WhatsApp message', { to: `${message.recipientId.slice(0, 4)}****` });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      const errMsg = errorData?.error?.message ?? `HTTP ${response.status}`;
      log.error('WhatsApp send failed', { status: response.status, error: errMsg });
      throw new Error(`WhatsApp API error: ${errMsg}`);
    }

    log.info('WhatsApp message sent successfully');
  }

  /**
   * Mark an incoming message as read (best-effort, non-throwing).
   */
  async markAsRead(messageId: string): Promise<void> {
    if (!this.isConfigured()) return;

    const url = `${this.apiBase}/${this.phoneNumberId}/messages`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    }).catch(() => { /* best-effort */ });
  }

  /**
   * Verify a Meta webhook subscription request.
   * Returns the hub.challenge string on success, null on failure.
   */
  verifyWebhook(params: { mode: string; token: string; challenge: string }): string | null {
    const secret = env.WHATSAPP_WEBHOOK_SECRET;
    if (!secret) return null;

    if (params.mode === 'subscribe' && params.token === secret) {
      log.info('WhatsApp webhook verified');
      return params.challenge;
    }

    log.warn('WhatsApp webhook verification failed', { mode: params.mode });
    return null;
  }
}

let _adapter: WhatsAppChannelAdapter | null = null;

export function getWhatsAppAdapter(): WhatsAppChannelAdapter {
  if (!_adapter) _adapter = new WhatsAppChannelAdapter();
  return _adapter;
}

/**
 * Extract all user messages from a WhatsApp webhook payload.
 */
export function extractWhatsAppMessages(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value.messages ?? []) {
        messages.push(msg);
      }
    }
  }
  return messages;
}

