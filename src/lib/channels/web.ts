import type { ChannelAdapter, InboundMessage, OutboundMessage } from './types';
import type { SupportedLanguage } from '@/lib/i18n/types';
import { z } from 'zod';

/** Zod schema for web chat inbound payloads */
export const webChatInputSchema = z.object({
  content: z.string().min(1).max(10000),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  language: z.string().optional(),
});

export type WebChatInput = z.infer<typeof webChatInputSchema>;

/**
 * Web channel adapter.
 * Handles messages from the Sandra web chat UI.
 */
export class WebChannelAdapter implements ChannelAdapter {
  readonly channelType = 'web' as const;

  async parseInbound(rawPayload: unknown): Promise<InboundMessage> {
    const data = webChatInputSchema.parse(rawPayload);

    return {
      channelType: 'web',
      channelUserId: data.userId ?? 'anonymous',
      content: data.content,
      language: (data.language as SupportedLanguage) ?? undefined,
      timestamp: new Date(),
      sessionId: data.sessionId,
    };
  }

  async formatOutbound(message: OutboundMessage): Promise<{ content: string; language?: string }> {
    return {
      content: message.content,
      language: message.language,
    };
  }

  async send(_message: OutboundMessage): Promise<void> {
    // Web channel sends responses inline in the API response — no push needed
  }

  isConfigured(): boolean {
    return true; // Web is always available
  }
}
