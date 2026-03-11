import type { ChannelAdapter, ChannelType } from './types';
import { WebChannelAdapter } from './web';
import { WhatsAppChannelAdapter } from './whatsapp';
import { InstagramChannelAdapter } from './instagram';
import { EmailChannelAdapter } from './email';
import { VoiceChannelAdapter } from './voice';

export type { ChannelAdapter, ChannelType, InboundMessage, OutboundMessage, MessageAttachment } from './types';
export { CHANNEL_TYPES } from './types';
export { WebChannelAdapter, webChatInputSchema, type WebChatInput } from './web';
export { WhatsAppChannelAdapter } from './whatsapp';
export { InstagramChannelAdapter } from './instagram';
export { EmailChannelAdapter } from './email';
export { VoiceChannelAdapter } from './voice';

/**
 * Get a channel adapter by type.
 */
export function getChannelAdapter(type: ChannelType): ChannelAdapter {
  switch (type) {
    case 'web':
      return new WebChannelAdapter();
    case 'whatsapp':
      return new WhatsAppChannelAdapter();
    case 'instagram':
      return new InstagramChannelAdapter();
    case 'email':
      return new EmailChannelAdapter();
    case 'voice':
      return new VoiceChannelAdapter();
  }
}
