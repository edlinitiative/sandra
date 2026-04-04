/**
 * sendWhatsAppMessage — send a WhatsApp message to a phone number
 * on behalf of Sandra (outbound agentic messaging).
 *
 * Uses the Meta WhatsApp Cloud API. The message is sent from Sandra's
 * configured phone number to the target number.
 *
 * This is an admin-only tool — only users with the admin role and
 * whatsapp:send scope may trigger outbound messages.
 *
 * Required scopes: whatsapp:send
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { env } from '@/lib/config';
import { actionRateLimiter } from '@/lib/actions/rate-limiter';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  to: z
    .string()
    .min(8)
    .describe("Recipient phone number in international format without '+', e.g. '50938001234'"),
  message: z
    .string()
    .min(1)
    .max(4096)
    .describe('Message text to send (plain text, up to 4096 characters)'),
  context: z
    .string()
    .max(500)
    .optional()
    .describe('Reason for sending this message (for audit trail)'),
});

async function sendWhatsApp(to: string, message: string): Promise<{ messageId: string }> {
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = env.WHATSAPP_API_VERSION;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp is not configured on this Sandra instance.');
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API error: ${res.status} — ${body}`);
  }

  const data = await res.json() as { messages?: Array<{ id: string }> };
  const messageId = data.messages?.[0]?.id ?? 'unknown';
  return { messageId };
}

const sendWhatsAppMessageTool: SandraTool = {
  name: 'sendWhatsAppMessage',
  description:
    "Send a WhatsApp message from Sandra to a specific phone number. ADMIN ONLY. Use when an admin instructs Sandra to reach out to someone on WhatsApp. Requires a phone number in international format (e.g. '50938001234'). This triggers an actual WhatsApp message.",
  parameters: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: "Recipient phone number in international format (no '+'), e.g. '50938001234'",
      },
      message: { type: 'string', description: 'Message text (max 4096 chars)', maxLength: 4096 },
      context: { type: 'string', description: 'Reason for sending (audit trail)', maxLength: 500 },
    },
    required: ['to', 'message'],
  },
  inputSchema,
  requiredScopes: ['whatsapp:send'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to send WhatsApp messages.' };
    }

    if (!actionRateLimiter.consume(userId, 'sendWhatsAppMessage')) {
      return { success: false, data: null, error: 'WhatsApp send rate limit reached. Please wait a few minutes.' };
    }

    try {
      const result = await sendWhatsApp(params.to, params.message);

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'admin_action',
        resource: 'sendWhatsAppMessage',
        details: { to: params.to, messageId: result.messageId, context: params.context },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          confirmation: `WhatsApp message sent to ${params.to}.`,
          messageId: result.messageId,
          to: params.to,
        },
      };
    } catch (error) {
      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'admin_action',
        resource: 'sendWhatsAppMessage',
        details: { to: params.to, error: error instanceof Error ? error.message : 'unknown' },
        success: false,
      }).catch(() => {});

      return {
        success: false,
        data: null,
        error: `Failed to send WhatsApp message: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(sendWhatsAppMessageTool);
export { sendWhatsAppMessageTool };
