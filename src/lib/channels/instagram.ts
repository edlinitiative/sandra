import type { ChannelAdapter, InboundMessage, OutboundMessage } from './types';

/**
 * Instagram channel adapter stub.
 * TODO: Implement using Meta Graph API / Instagram Messaging API.
 */
export class InstagramChannelAdapter implements ChannelAdapter {
  readonly channelType = 'instagram' as const;

  async parseInbound(_rawPayload: unknown): Promise<InboundMessage> {
    throw new Error('Instagram channel not yet implemented');
  }

  async formatOutbound(_message: OutboundMessage): Promise<unknown> {
    throw new Error('Instagram channel not yet implemented');
  }

  async send(_message: OutboundMessage): Promise<void> {
    throw new Error('Instagram channel not yet implemented');
  }

  isConfigured(): boolean {
    return false;
  }
}
