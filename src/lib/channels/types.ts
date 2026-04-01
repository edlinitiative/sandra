import type { SupportedLanguage } from '@/lib/i18n/types';

/**
 * Channel system type definitions.
 */

export const CHANNEL_TYPES = ['web', 'whatsapp', 'instagram', 'email', 'voice'] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

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
