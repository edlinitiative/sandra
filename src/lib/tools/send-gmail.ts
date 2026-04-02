/**
 * sendGmail — send an email from the user's Gmail (via domain-wide delegation).
 *
 * Queued with requiresApproval = true — admin must approve before delivery.
 * This is the human-in-the-loop safeguard for outbound email via the user's real mailbox.
 *
 * Resend remains the system/platform email transport.
 * This tool is ONLY for sending as the authenticated domain user.
 *
 * Required scopes: gmail:send
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveTenantForUser } from '@/lib/google/context';
import { enqueueAction } from '@/lib/actions/queue';
import { actionRateLimiter } from '@/lib/actions/rate-limiter';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  to: z
    .array(z.string().email())
    .min(1)
    .max(10)
    .describe('Recipient email address(es)'),
  subject: z
    .string()
    .min(3)
    .max(200)
    .describe('Email subject line'),
  body: z
    .string()
    .min(10)
    .max(4000)
    .describe('Email body text (plain text)'),
  cc: z
    .array(z.string().email())
    .optional()
    .describe('CC email addresses'),
  context: z
    .string()
    .max(500)
    .optional()
    .describe('Why this email is being sent (for admin review)'),
});

const sendGmail: SandraTool = {
  name: 'sendGmail',
  description:
    "Send an email from the user's work Gmail account. The email will be queued for admin approval before being sent — it will NOT send immediately. Use when the user explicitly asks Sandra to send an email from their work account to a specific person.",
  parameters: {
    type: 'object',
    properties: {
      to: {
        type: 'array',
        items: { type: 'string', format: 'email' },
        description: 'Recipient email address(es)',
      },
      subject: { type: 'string', description: 'Email subject line', maxLength: 200 },
      body: { type: 'string', description: 'Email body (plain text)', maxLength: 4000 },
      cc: {
        type: 'array',
        items: { type: 'string', format: 'email' },
        description: 'CC addresses (optional)',
      },
      context: { type: 'string', description: 'Reason for this email (admin review)', maxLength: 500 },
    },
    required: ['to', 'subject', 'body'],
  },
  inputSchema,
  requiredScopes: ['gmail:send'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to send Gmail.' };
    }

    // Verify tenant membership
    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Gmail access.' };
    }

    // Rate limit: max 3 sends per user per 10 min
    if (!actionRateLimiter.consume(userId, 'sendGmail')) {
      return { success: false, data: null, error: 'Gmail send rate limit reached. Please wait a few minutes.' };
    }

    // Resolve sender email from user record
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    const senderEmail = user?.email;
    if (!senderEmail) {
      return { success: false, data: null, error: 'No email address associated with your account.' };
    }

    // Enqueue with approval required
    const result = await enqueueAction({
      userId,
      sessionId: context.sessionId,
      channel: 'web',
      tool: 'sendGmail',
      input: {
        from: senderEmail,
        to: params.to,
        cc: params.cc,
        subject: params.subject,
        body: params.body,
        context: params.context,
        tenantId,
      },
      requiresApproval: true,
      metadata: { draftedAt: new Date().toISOString(), senderName: user?.name },
    });

    await logAuditEvent({
      userId,
      sessionId: context.sessionId,
      action: 'admin_action',
      resource: 'sendGmail',
      details: { to: params.to, subject: params.subject, actionRequestId: result.actionId, tenantId },
      success: true,
    }).catch(() => {});

    return {
      success: true,
      data: {
        message: `Email draft queued for admin approval. It will be sent from ${senderEmail} once approved.`,
        actionRequestId: result.actionId,
        from: senderEmail,
        to: params.to,
        subject: params.subject,
      },
    };
  },
};

toolRegistry.register(sendGmail);
