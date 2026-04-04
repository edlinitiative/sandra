/**
 * draftGmail — create a draft in the user's Gmail (without sending).
 *
 * Unlike sendGmail, drafts are created immediately (no approval queue)
 * since they stay in the user's Drafts folder and require manual send.
 *
 * Required scopes: gmail:draft
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { createDraft } from '@/lib/google/gmail';
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
});

const draftGmail: SandraTool = {
  name: 'draftGmail',
  description:
    "Create a draft email in the user's work Gmail. The draft will appear in the user's Drafts folder — it will NOT be sent automatically. Use when the user wants to prepare an email for later or asks Sandra to draft something in Gmail.",
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
    },
    required: ['to', 'subject', 'body'],
  },
  inputSchema,
  requiredScopes: ['gmail:draft'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to create Gmail drafts.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Gmail access.' };
    }

    // Resolve sender email
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user?.email) {
      return { success: false, data: null, error: 'No email address associated with your account.' };
    }

    try {
      const ctx = await resolveGoogleContext(tenantId, user.email);

      const result = await createDraft(ctx, {
        from: user.email,
        to: params.to,
        cc: params.cc,
        subject: params.subject,
        body: params.body,
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'draftGmail',
        details: { to: params.to, subject: params.subject, draftId: result.draftId, tenantId },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          message: `Draft created in your Gmail. You can find it in your Drafts folder and send it when ready.`,
          draftId: result.draftId,
          from: user.email,
          to: params.to,
          subject: params.subject,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create Gmail draft',
      };
    }
  },
};

toolRegistry.register(draftGmail);
