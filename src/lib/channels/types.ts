import type { SupportedLanguage } from '@/lib/i18n/types';

/**
 * Channel system type definitions.
 */

export const CHANNEL_TYPES = ['web', 'whatsapp', 'instagram', 'email', 'voice'] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

/** Default channel when none is specified */
export const DEFAULT_CHANNEL: ChannelType = 'web';

/** Normalized inbound message from any channel */
export interface InboundMessage {
  channelType: ChannelType;
  channelUserId: string; // Platform-specific user ID
  content: string;
  language?: SupportedLanguage;
  timestamp: Date;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  /** For channels that support media (images, voice notes, etc.) */
  attachments?: MessageAttachment[];
  /** Whether this message originates from a group chat */
  isGroup?: boolean;
  /** Group identifier (WhatsApp group JID, etc.) */
  groupId?: string;
}

/** Attachment on a message */
export interface MessageAttachment {
  type: 'image' | 'audio' | 'video' | 'file';
  url: string;
  mimeType?: string;
  filename?: string;
  /** Base64-encoded bytes — used to pass images to vision models without persisting files */
  data?: string;
}

/** Normalized outbound response to any channel */
export interface OutboundMessage {
  channelType: ChannelType;
  recipientId: string;
  content: string;
  language?: SupportedLanguage;
  metadata?: Record<string, unknown>;
}

/** Interface that all channel adapters must implement */
export interface ChannelAdapter {
  readonly channelType: ChannelType;

  /** Parse platform-specific webhook/request into a normalized InboundMessage */
  parseInbound(rawPayload: unknown): Promise<InboundMessage>;

  /** Format a response for the platform */
  formatOutbound(message: OutboundMessage): Promise<unknown>;

  /** Send a response through the platform's API */
  send(message: OutboundMessage): Promise<void>;

  /** Check if the channel is configured and ready */
  isConfigured(): boolean;
}

/**
 * Per-channel prompt style instructions injected into the system prompt.
 * `null` means no channel-specific style adjustments are needed.
 *
 * To add support for a new social channel (e.g., Telegram), simply add an
 * entry here — the prompt builder picks it up automatically.
 */
export const CHANNEL_PROMPT_STYLES: Record<ChannelType, string | null> = {
  web: null,
  whatsapp: `You are chatting on WhatsApp. Keep responses concise and mobile-friendly. Use short paragraphs. Avoid markdown headers (use bold **text** sparingly). Limit responses to 1-3 short paragraphs unless the user explicitly asks for detail.`,
  instagram: `You are chatting on Instagram DM. Keep responses concise and mobile-friendly. Use short paragraphs. Avoid markdown headers (use bold **text** sparingly). Limit responses to 1-3 short paragraphs unless the user explicitly asks for detail.`,
  email: `You are composing an email response. Use proper email formatting with clear paragraphs. Be thorough but organized.`,
  voice: `You are in a voice conversation. Keep responses conversational and natural. Avoid lists, links, or formatting that doesn't translate well to speech. Be concise — aim for 2-3 sentences per turn.`,
};
