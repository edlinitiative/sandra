import type { ChannelAdapter, InboundMessage, OutboundMessage } from './types';

/**
 * Email channel adapter stub.
 * TODO: Implement using SMTP / SendGrid / SES.
 */
export class EmailChannelAdapter implements ChannelAdapter {
  readonly channelType = 'email' as const;

  async parseInbound(_rawPayload: unknown): Promise<InboundMessage> {
    throw new Error('Email channel not yet implemented');
  }

  async formatOutbound(_message: OutboundMessage): Promise<unknown> {
    throw new Error('Email channel not yet implemented');
  }

  async send(_message: OutboundMessage): Promise<void> {
    throw new Error('Email channel not yet implemented');
  }

  isConfigured(): boolean {
    return false;
  }
}
