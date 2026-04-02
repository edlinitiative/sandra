/**
 * queueReminder — schedule a reminder message for the user at a future time.
 * The reminder is stored in the action queue. The delivery worker (future phase)
 * will execute it when the scheduled time arrives.
 *
 * Required scopes: actions:submit
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { enqueueAction } from '@/lib/actions/queue';
import { actionRateLimiter } from '@/lib/actions/rate-limiter';

const MAX_FUTURE_DAYS = 30;

const inputSchema = z.object({
  message: z
    .string()
    .min(3)
    .max(500)
    .describe('The reminder message to deliver'),
  deliverAt: z
    .string()
    .datetime()
    .optional()
    .describe('ISO 8601 datetime when the reminder should be delivered (default: tomorrow at 9 AM)'),
  channel: z
    .enum(['web', 'whatsapp', 'email', 'instagram'])
    .optional()
    .default('web')
    .describe('Which channel to deliver the reminder on'),
});

const queueReminder: SandraTool = {
  name: 'queueReminder',
  description:
    'Queue a future reminder message for the user. Use this when the user explicitly asks to be reminded about something at a specific time (e.g. "remind me to check my application in 3 days", "remind me about the scholarship deadline"). The reminder is stored and will be delivered when the time arrives.',
  parameters: {
    type: 'object',
    properties: {
      message:   { type: 'string', description: 'The reminder message', maxLength: 500 },
      deliverAt: { type: 'string', format: 'date-time', description: 'When to deliver (ISO 8601)' },
      channel:   { type: 'string', enum: ['web', 'whatsapp', 'email', 'instagram'], default: 'web' },
    },
    required: ['message'],
  },
  inputSchema,
  requiredScopes: ['actions:submit'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId ?? context.sessionId;

    // Rate limit
    if (!actionRateLimiter.consume(userId, 'queueReminder')) {
      return { success: false, data: null, error: 'Too many reminders queued. Please wait a few minutes.' };
    }

    // Default: tomorrow at 9 AM UTC
    let deliverAt = params.deliverAt ? new Date(params.deliverAt) : (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(9, 0, 0, 0);
      return d;
    })();

    // Clamp to max future window
    const maxDate = new Date(Date.now() + MAX_FUTURE_DAYS * 24 * 60 * 60 * 1000);
    if (deliverAt > maxDate) {
      deliverAt = maxDate;
    }

    // Clamp to at least 60 seconds in the future
    if (deliverAt.getTime() < Date.now() + 60_000) {
      deliverAt = new Date(Date.now() + 60_000);
    }

    const result = await enqueueAction({
      userId:           context.userId,
      sessionId:        context.sessionId,
      channel:          params.channel ?? 'web',
      tool:             'queueReminder',
      input:            { message: params.message, deliverAt: deliverAt.toISOString(), channel: params.channel },
      requiresApproval: false,
      metadata:         { scheduledAt: deliverAt.toISOString() },
    });

    return {
      success: true,
      data: {
        actionId:  result.actionId,
        message:   params.message,
        deliverAt: deliverAt.toISOString(),
        channel:   params.channel ?? 'web',
        confirmation: `Reminder queued! I'll remind you at ${deliverAt.toUTCString()}.`,
      },
    };
  },
};

toolRegistry.register(queueReminder);
export { queueReminder };
