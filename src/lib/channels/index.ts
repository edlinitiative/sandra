import type { ChannelAdapter, ChannelType } from './types';
import { WebChannelAdapter } from './web';
import { WhatsAppChannelAdapter } from './whatsapp';
import { InstagramChannelAdapter } from './instagram';
import { EmailChannelAdapter } from './email';
import { VoiceChannelAdapter } from './voice';
export type { ChannelAdapter, ChannelType, InboundMessage, OutboundMessage, MessageAttachment } from './types';
export { CHANNEL_TYPES } from './types';
export { WebChannelAdapter, webChatInputSchema, type WebChatInput } from './web';
export {
  WhatsAppChannelAdapter,
  getWhatsAppAdapter,
  extractWhatsAppMessages,
  type WhatsAppWebhookPayload,
  type WhatsAppMessage,
} from './whatsapp';
export {
  InstagramChannelAdapter,
  getInstagramAdapter,
  extractInstagramMessaging,
  type InstagramWebhookPayload,
  type InstagramMessage,
} from './instagram';
export {
  EmailChannelAdapter,
  getEmailAdapter,
  type InboundEmail,
} from './email';
export { VoiceChannelAdapter, getVoiceAdapter, transcribeAudio, synthesizeSpeech, type VoiceInboundPayload, type TranscriptionResult, type TtsVoice, type TtsFormat } from './voice';
export {
  formatForVoice,
  estimateSpeakDuration,
  VOICE_MAX_LENGTH,
} from './voice-formatter';
export {
  findChannelIdentity,
  resolveChannelIdentity,
  linkChannelIdentity,
  getUserChannelIdentities,
  type ChannelIdentityRecord,
  type ResolveChannelIdentityParams,
  type ResolveChannelIdentityResult,
} from './channel-identity';
export {
  formatForWhatsApp,
  splitForWhatsApp,
  buildTypingIndicatorText,
  WHATSAPP_MAX_LENGTH,
} from './whatsapp-formatter';
export {
  formatForInstagram,
  splitForInstagram,
  INSTAGRAM_MAX_LENGTH,
} from './instagram-formatter';
export {
  formatForEmail,
  buildEmailBody,
  extractEmailReply,
  EMAIL_MAX_LENGTH,
} from './email-formatter';

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
