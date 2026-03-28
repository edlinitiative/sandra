/**
 * draftEmail — compose an outbound email on the user's behalf.
 * The draft is placed in the action queue with requiresApproval = true.
 * An admin must approve it before it is actually sent.
 *
 * This is the human-in-the-loop safeguard for outbound email actions.
 *
 * Required scopes: actions:submit
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { enqueueAction } from '@/lib/actions/queue';
import { actionRateLimiter } from '@/lib/actions/rate-limiter';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  to: z
    .string()
    .email()
    .describe('Recipient email address'),
  subject: z
    .string()
    .min(3)
    .max(200)
    .describe('Email subject line'),
  body: z
    .string()
    .min(10)
    .max(4000)
    .describe('Email body text (plain text or Markdown)'),
  context: z
    .string()
    .max(500)
    .optional()
    .describe('Optional context or reason for this email (for admin review)'),
});

const draftEmail: SandraTool = {
  name: 'draftEmail',
  description:
    'Compose an outbound email on the user\'s behalf. The draft will be queued for admin review before it is sent — it will NOT be sent immediately. Use this only when the user explicitly asks Sandra to draft or send an email to a specific address.',
  parameters: {
    type: 'object',
    properties: {
      to:      { type: 'string', format: 'email', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject line', maxLength: 200 },
      body:    { type: 'string', description: 'Email body (plain text or Markdown)', maxLength: 4000 },
      context: { type: 'string', description: 'Why this email is being drafted (for admin review)', maxLength: 500 },
    },
    required: ['to', 'subject', 'body'],
  },
  inputSchema,
  requiredScopes: ['actions:submit'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId ?? context.sessionId;

    // Rate limit: max 2 email drafts per user per 10 min (high-sensitivity action)
    if (!actionRateLimiter.consume(userId, 'draftEmail')) {
      return { success: false, data: null, error: 'Email draft rate limit reached. Please wait a few minutes before drafting another email.' };
    }

    // requiresApproval = true — admin must review before delivery
    const result = await enqueueAction({
      userId:           context.userId,
      sessionId:        context.sessionId,
      channel:          'web',
      tool:             'draftEmail',
      input:            params as Record<string, unknown>,
      requiresApproval: true,
      metadata:         { draftedAt: new Date().toISOString() },
    });

    await logAuditEvent({
      userId:    context.userId,
      sessionId: context.sessionId,
      action:    'admin_action',
      resource:  'draftEmail',
      details:   { actionId: result.actionId, to: params.to, subject: params.subject },
      success:   true,
    });

    return {
      success: true,
      data: {
        actionId:  result.actionId,
        status:    'pending_approval',
        to:        params.to,
        subject:   params.subject,
        message:   `Your email draft to ${params.to} has been submitted for review (ID: ${result.actionId}). An EdLight administrator will review and send it on your behalf.`,
      },
    };
  },
};

toolRegistry.register(draftEmail);
export { draftEmail };
