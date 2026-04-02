import type { ChannelAdapter, InboundMessage, OutboundMessage, MessageAttachment } from './types';
import { formatForWhatsApp } from './whatsapp-formatter';
import { transcribeAudio } from './voice';
import { env } from '@/lib/config';
import { createLogger } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
    'audio/aac': 'aac', 'audio/mp4': 'mp4', 'audio/wav': 'wav',
    'audio/x-wav': 'wav', 'audio/m4a': 'm4a', 'audio/webm': 'webm',
    'audio/flac': 'flac', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  };
  return map[mimeType] ?? 'bin';
}

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
    let attachments: MessageAttachment[] | undefined;

    if (message.type === 'text' && message.text?.body) {
      content = message.text.body;
    } else if (message.type === 'button' && message.button?.text) {
      content = message.button.text;
    } else if (message.type === 'interactive' && message.interactive?.button_reply?.title) {
      content = message.interactive.button_reply.title;
    } else if (message.type === 'audio' && message.audio?.id) {
      try {
        const { buffer, mimeType } = await this.downloadMedia(message.audio.id);
        const cleanMime = mimeType.split(';')[0]!.trim();
        const transcript = await transcribeAudio(buffer, cleanMime, `voice.${mimeToExtension(cleanMime)}`);
        content = `[Voice note]: ${transcript.text}`;
        log.info('WhatsApp voice note transcribed', { chars: transcript.text.length });
      } catch (err) {
        log.warn('WhatsApp voice note transcription failed', { error: err instanceof Error ? err.message : 'unknown' });
        content = '[Voice note received — transcription unavailable]';
      }
    } else if (message.type === 'image' && message.image?.id) {
      try {
        const { buffer, mimeType } = await this.downloadMedia(message.image.id);
        const cleanMime = mimeType.split(';')[0]!.trim();
        const base64 = buffer.toString('base64');
        content = message.image.caption || '[Image]';
        attachments = [{ type: 'image', url: `data:${cleanMime};base64,${base64}`, mimeType: cleanMime, data: base64 }];
        log.info('WhatsApp image processed', { mimeType: cleanMime, bytes: buffer.length });
      } catch (err) {
        log.warn('WhatsApp image download failed', { error: err instanceof Error ? err.message : 'unknown' });
        content = '[Image received — could not process]';
      }
    } else {
      content = `[${message.type} message received — not supported yet]`;
    }

    return {
      channelType: 'whatsapp',
      channelUserId: message.from,
      content,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      attachments,
      metadata: {
        whatsappMessageId: message.id,
        phoneNumberId: value.metadata.phone_number_id,
        displayName: contact?.profile?.name ?? null,
        messageType: message.type,
      },
    };
  }

  /**
   * Download a media file from WhatsApp CDN.
   * Step 1: GET /{media-id} → retrieve the CDN URL.
   * Step 2: GET {url} with Bearer auth → download the bytes.
   */
  private async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const metaRes = await fetch(`${this.apiBase}/${mediaId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!metaRes.ok) throw new Error(`Media metadata fetch failed: ${metaRes.status}`);
    const meta = await metaRes.json() as { url: string; mime_type: string };

    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!fileRes.ok) throw new Error(`Media download failed: ${fileRes.status}`);
    return { buffer: Buffer.from(await fileRes.arrayBuffer()), mimeType: meta.mime_type };
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
   * Send a "typing_on" indicator to show the user Sandra is composing.
   * Best-effort — fire-and-forget, never throws.
   */
  async sendTypingIndicator(recipientPhone: string): Promise<void> {
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
        to: recipientPhone,
        type: 'reaction',
        status: 'typing_indicator',
        recipient_type: 'individual',
      }),
    }).catch(() => { /* best-effort */ });
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

