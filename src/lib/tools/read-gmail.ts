/**
 * readGmail — list and read the user's Gmail messages.
 *
 * Uses domain-wide delegation to impersonate the user's Workspace mailbox.
 *
 * Required scopes: gmail:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForContext } from '@/lib/google/context';
import { listMessages, getMessage } from '@/lib/google/gmail';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Gmail search query using the same syntax as Gmail's search box, e.g. 'is:unread', 'from:boss@company.com', 'subject:invoice', 'after:2026/04/01'"),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('Number of messages to return (default 5, max 20)'),
  messageId: z
    .string()
    .optional()
    .describe('If provided, fetch this single message by ID in full detail'),
  labelIds: z
    .array(z.string())
    .optional()
    .describe("Filter by label IDs, e.g. ['INBOX'], ['UNREAD'], ['SENT']"),
});

const readGmailTool: SandraTool = {
  name: 'readGmail',
  description:
    "Read the user's Gmail inbox. Use when the user asks to check their email, find a message, read a specific email, or search their inbox. Supports Gmail search syntax. Returns sender, subject, date, snippet, and full body.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: "Gmail search query (e.g. 'is:unread', 'from:boss@co.com')" },
      maxResults: { type: 'number', description: 'Number of messages to return (default 5)', default: 5 },
      messageId: { type: 'string', description: 'Fetch a single message by its ID' },
      labelIds: {
        type: 'array',
        items: { type: 'string' },
        description: "Label filter, e.g. ['INBOX', 'UNREAD']",
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['gmail:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to read Gmail.' };
    }

    const tenantId = await resolveTenantForContext(userId, context.workspaceEmail);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Gmail access.' };
    }

    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      const userEmail = user?.email ?? context.workspaceEmail ?? null;
      if (!userEmail) {
        return { success: false, data: null, error: 'No email address associated with your account.' };
      }

      const ctx = await resolveGoogleContext(tenantId, userEmail);

      if (params.messageId) {
        const message = await getMessage(ctx, params.messageId);
        await logAuditEvent({
          userId,
          sessionId: context.sessionId,
          action: 'data_access',
          resource: 'readGmail',
          details: { messageId: params.messageId, tenantId },
          success: true,
        }).catch(() => {});
        return { success: true, data: { message } };
      }

      const messages = await listMessages(ctx, {
        q: params.query,
        maxResults: params.maxResults,
        labelIds: params.labelIds,
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'readGmail',
        details: { query: params.query, resultCount: messages.length, tenantId },
        success: true,
      }).catch(() => {});

      if (messages.length === 0) {
        return { success: true, data: { message: 'No messages found matching your query.', messages: [] } };
      }

      return {
        success: true,
        data: {
          message: `Found ${messages.length} message(s).`,
          messages,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to read Gmail: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(readGmailTool);
export { readGmailTool };
