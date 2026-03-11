import type { ChannelAdapter, InboundMessage, OutboundMessage } from './types';

/**
 * Voice channel adapter stub.
 * TODO: Implement using Twilio / WebRTC / similar.
 */
export class VoiceChannelAdapter implements ChannelAdapter {
  readonly channelType = 'voice' as const;

  async parseInbound(_rawPayload: unknown): Promise<InboundMessage> {
    throw new Error('Voice channel not yet implemented');
  }

  async formatOutbound(_message: OutboundMessage): Promise<unknown> {
    throw new Error('Voice channel not yet implemented');
  }

  async send(_message: OutboundMessage): Promise<void> {
    throw new Error('Voice channel not yet implemented');
  }

  isConfigured(): boolean {
    return false;
  }
}
