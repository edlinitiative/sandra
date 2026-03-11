import type { ChannelAdapter, InboundMessage, OutboundMessage } from './types';

/**
 * WhatsApp channel adapter stub.
 * TODO: Implement using Meta Business API / WhatsApp Cloud API.
 */
export class WhatsAppChannelAdapter implements ChannelAdapter {
  readonly channelType = 'whatsapp' as const;

  async parseInbound(_rawPayload: unknown): Promise<InboundMessage> {
    // TODO: Parse WhatsApp webhook payload
    throw new Error('WhatsApp channel not yet implemented');
  }

  async formatOutbound(_message: OutboundMessage): Promise<unknown> {
    // TODO: Format for WhatsApp message API
    throw new Error('WhatsApp channel not yet implemented');
  }

  async send(_message: OutboundMessage): Promise<void> {
    // TODO: Send via WhatsApp Cloud API
    throw new Error('WhatsApp channel not yet implemented');
  }

  isConfigured(): boolean {
    return false; // Not yet configured
  }
}
