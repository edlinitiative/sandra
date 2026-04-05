/**
 * replyGmail — reply to an existing Gmail thread.
 *
 * Required scopes: gmail:send
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForContext } from '@/lib/google/context';
import { replyToMessage } from '@/lib/google/gmail';
import { actionRateLimiter } from '@/lib/actions/rate-limiter';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  threadId: z
    .string()
    .min(1)
    .describe('The Gmail thread ID to reply in'),
  inReplyToMessageId: z
    .string()
    .min(1)
    .describe('The message ID of the specific message being replied to (used for threading headers)'),
  to: z
    .array(z.string().email())
    .min(1)
    .max(10)
    .describe('Reply recipient email address(es)'),
  subject: z
    .string()
    .min(1)
    .max(200)
    .describe('Email subject (should start with "Re: " for proper threading)'),
  body: z
    .string()
    .min(1)
    .max(4000)
    .describe('Reply body text (plain text)'),
  cc: z
    .array(z.string().email())
    .optional()
    .describe('CC email addresses'),
});

const replyGmailTool: SandraTool = {
  name: 'replyGmail',
  description:
    "Reply to an existing Gmail email thread. Use when the user says 'reply to', 'respond to', or 'write back to' an email. You will need the thread ID and message ID — use readGmail to find them first. Only available to users with the gmail:send scope.",
  parameters: {
    type: 'object',
    properties: {
      threadId: { type: 'string', description: 'Gmail thread ID' },
      inReplyToMessageId: { type: 'string', description: 'Message ID being replied to (for threading)' },
      to: { type: 'array', items: { type: 'string', format: 'email' }, description: 'Reply recipients' },
      subject: { type: 'string', description: 'Subject line (use "Re: <original subject>")' },
      body: { type: 'string', description: 'Reply body (plain text)', maxLength: 4000 },
      cc: { type: 'array', items: { type: 'string', format: 'email' }, description: 'CC addresses' },
    },
    required: ['threadId', 'inReplyToMessageId', 'to', 'subject', 'body'],
  },
  inputSchema,
  requiredScopes: ['gmail:send'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to reply to Gmail.' };
    }

    const tenantId = await resolveTenantForContext(userId, context.workspaceEmail);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Gmail access.' };
    }

    if (!actionRateLimiter.consume(userId, 'replyGmail')) {
      return { success: false, data: null, error: 'Gmail send rate limit reached. Please wait a few minutes.' };
    }

    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      const userEmail = user?.email ?? context.workspaceEmail ?? null;
      if (!userEmail) {
        return { success: false, data: null, error: 'No email address associated with your account.' };
      }

      const ctx = await resolveGoogleContext(tenantId, userEmail);
      const result = await replyToMessage(ctx, {
        from: userEmail,
        threadId: params.threadId,
        inReplyToMessageId: params.inReplyToMessageId,
        to: params.to,
        subject: params.subject,
        body: params.body,
        cc: params.cc,
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'admin_action',
        resource: 'replyGmail',
        details: { to: params.to, subject: params.subject, threadId: params.threadId, messageId: result.messageId, tenantId },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          confirmation: `Reply sent to ${params.to.join(', ')}.`,
          messageId: result.messageId,
          threadId: result.threadId,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to send reply: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(replyGmailTool);
export { replyGmailTool };
