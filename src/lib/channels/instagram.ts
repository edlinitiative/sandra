import type { ChannelAdapter, InboundMessage, OutboundMessage, MessageAttachment } from './types';
import { formatForInstagram } from './instagram-formatter';
import { transcribeAudio } from './voice';
import { env } from '@/lib/config';
import { createLogger } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mimeToExtension(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('flac')) return 'flac';
  return 'mp3';
}

const log = createLogger('channels:instagram');

// ─── Instagram Graph API payload types ───────────────────────────────────────

export interface InstagramWebhookPayload {
  object: 'instagram' | 'page';
  entry: InstagramEntry[];
}

interface InstagramEntry {
  id: string;
  time: number;
  messaging?: InstagramMessaging[];
}

interface InstagramMessaging {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: InstagramMessage;
  postback?: InstagramPostback;
}

export interface InstagramMessage {
  mid: string;
  text?: string;
  attachments?: InstagramAttachment[];
  is_echo?: boolean;
}

interface InstagramAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'ig_reel' | 'share' | 'story_mention';
  payload: { url?: string };
}

interface InstagramPostback {
  mid: string;
  title: string;
  payload: string;
}

interface InstagramOutboundBody {
  recipient: { id: string };
  message: { text: string };
  messaging_type: 'RESPONSE';
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * Instagram Messaging API channel adapter.
 * Handles inbound DM webhooks and outbound message delivery via Graph API.
 */
export class InstagramChannelAdapter implements ChannelAdapter {
  readonly channelType = 'instagram' as const;

  private get apiBase(): string {
    return `https://graph.instagram.com/${env.INSTAGRAM_API_VERSION}`;
  }

  private get pageAccessToken(): string {
    return env.INSTAGRAM_PAGE_ACCESS_TOKEN ?? '';
  }

  isConfigured(): boolean {
    return Boolean(
      env.INSTAGRAM_PAGE_ACCESS_TOKEN &&
      env.INSTAGRAM_VERIFY_TOKEN,
    );
  }

  /**
   * Verify a Meta webhook subscription challenge.
   */
  verifyWebhook(params: { mode: string; token: string; challenge: string }): string | null {
    const secret = env.INSTAGRAM_VERIFY_TOKEN;
    if (!secret) return null;

    if (params.mode === 'subscribe' && params.token === secret) {
      log.info('Instagram webhook verified');
      return params.challenge;
    }

    log.warn('Instagram webhook verification failed', { mode: params.mode });
    return null;
  }

  /**
   * Parse an Instagram webhook payload into a normalised InboundMessage.
   * Throws with 'SKIP:...' for echoes, postback events with no text, etc.
   */
  async parseInbound(rawPayload: unknown): Promise<InboundMessage> {
    const payload = rawPayload as InstagramWebhookPayload;

    if (payload.object !== 'instagram' && payload.object !== 'page') {
      throw new Error(`Unexpected webhook object: ${payload.object}`);
    }

    const entry = payload.entry?.[0];
    const messaging = entry?.messaging?.[0];

    if (!messaging) {
      throw new Error('SKIP: No messaging events in webhook payload');
    }

    const senderId = messaging.sender.id;

    // Skip echo messages (sent by the page itself)
    if (messaging.message?.is_echo) {
      throw new Error('SKIP: Echo message');
    }

    let content = '';
    let attachments: MessageAttachment[] | undefined;

    if (messaging.message?.text) {
      content = messaging.message.text;
    } else if (messaging.postback?.title) {
      content = messaging.postback.title;
    } else if (messaging.message?.attachments?.length) {
      const attachment = messaging.message.attachments[0]!;
      const attachUrl = attachment.payload.url;

      if (attachment.type === 'audio' && attachUrl) {
        try {
          const { buffer, mimeType } = await this.downloadAttachment(attachUrl);
          const cleanMime = mimeType.split(';')[0]!.trim();
          const transcript = await transcribeAudio(buffer, cleanMime, `voice.${mimeToExtension(cleanMime)}`);
          content = `[Voice note]: ${transcript.text}`;
          log.info('Instagram voice note transcribed', { chars: transcript.text.length });
        } catch (err) {
          log.warn('Instagram voice note transcription failed', { error: err instanceof Error ? err.message : 'unknown' });
          content = '[Voice note received — transcription unavailable]';
        }
      } else if (attachment.type === 'image' && attachUrl) {
        try {
          const { buffer, mimeType } = await this.downloadAttachment(attachUrl);
          const cleanMime = mimeType.split(';')[0]!.trim();
          const base64 = buffer.toString('base64');
          content = '[Image]';
          attachments = [{ type: 'image', url: `data:${cleanMime};base64,${base64}`, mimeType: cleanMime, data: base64 }];
          log.info('Instagram image processed', { mimeType: cleanMime, bytes: buffer.length });
        } catch (err) {
          log.warn('Instagram image download failed', { error: err instanceof Error ? err.message : 'unknown' });
          content = '[Image received — could not process]';
        }
      } else {
        content = `[${attachment.type} received — not supported yet]`;
      }
    } else {
      throw new Error('SKIP: No processable content in messaging event');
    }

    return {
      channelType: 'instagram',
      channelUserId: senderId,
      content,
      timestamp: new Date(messaging.timestamp),
      attachments,
      metadata: {
        instagramMessageId: messaging.message?.mid ?? messaging.postback?.mid,
        pageId: messaging.recipient.id,
        messageType: messaging.message ? 'message' : 'postback',
      },
    };
  }

  /**
   * Download a media file from an Instagram CDN URL.
   * Instagram attachment URLs are public and don't require auth headers.
   */
  private async downloadAttachment(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Attachment download failed: ${res.status}`);
    const mimeType = (res.headers.get('content-type') ?? 'audio/mpeg').split(';')[0]!.trim();
    return { buffer: Buffer.from(await res.arrayBuffer()), mimeType };
  }

  /**
   * Fetch the display name of an Instagram user by their IGSID.
   * Returns null if unavailable or on any error.
   */
  async fetchSenderName(senderId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      const url = `${this.apiBase}/${senderId}?fields=name&access_token=${this.pageAccessToken}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json() as { name?: string };
      return data.name ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Send a "typing_on" indicator so the user sees Sandra is composing a reply.
   * Best-effort — fire-and-forget, never throws.
   */
  async sendTypingIndicator(recipientId: string, pageId?: string): Promise<void> {
    if (!this.isConfigured()) return;

    const endpoint = pageId
      ? `${this.apiBase}/${pageId}/messages`
      : `${this.apiBase}/me/messages`;

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.pageAccessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: 'typing_on',
      }),
    }).catch(() => { /* best-effort */ });
  }

  /**
   * Format an outbound message as an Instagram Graph API request body.
   */
  async formatOutbound(message: OutboundMessage): Promise<InstagramOutboundBody> {
    return {
      recipient: { id: message.recipientId },
      message: { text: formatForInstagram(message.content) },
      messaging_type: 'RESPONSE',
    };
  }

  /**
   * Send a message via the Instagram Graph API.
   */
  async send(message: OutboundMessage): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Instagram adapter not configured: missing credentials');
    }

    const body = await this.formatOutbound(message);
    // Instagram API with Instagram Login requires:
    // - graph.instagram.com (not graph.facebook.com)
    // - Authorization: Bearer header (not access_token query param)
    // - /{instagram-scoped-id}/messages endpoint
    const igScopedId = message.metadata?.pageId as string | undefined;
    const endpoint = igScopedId ? `${this.apiBase}/${igScopedId}/messages` : `${this.apiBase}/me/messages`;

    log.info('Sending Instagram message', { to: `${message.recipientId.slice(0, 4)}****`, endpoint });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.pageAccessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      const errMsg = errorData?.error?.message ?? `HTTP ${response.status}`;
      log.error('Instagram send failed', { status: response.status, error: errMsg });
      throw new Error(`Instagram API error: ${errMsg}`);
    }

    log.info('Instagram message sent successfully');
  }
}

let _adapter: InstagramChannelAdapter | null = null;

export function getInstagramAdapter(): InstagramChannelAdapter {
  if (!_adapter) _adapter = new InstagramChannelAdapter();
  return _adapter;
}

/**
 * Extract all messaging events from an Instagram webhook payload.
 */
export function extractInstagramMessaging(payload: InstagramWebhookPayload): InstagramMessaging[] {
  const events: InstagramMessaging[] = [];
  for (const entry of payload.entry ?? []) {
    for (const messaging of entry.messaging ?? []) {
      events.push(messaging);
    }
  }
  return events;
}

