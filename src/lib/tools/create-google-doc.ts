/**
 * createGoogleDoc — create a new Google Doc in the user's Drive.
 *
 * Required scopes: drive:write
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { createGoogleDoc } from '@/lib/google/drive';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('Title (name) for the new Google Doc'),
  content: z
    .string()
    .max(50000)
    .optional()
    .describe('Initial text content to write into the document (optional)'),
});

const createGoogleDocTool: SandraTool = {
  name: 'createGoogleDoc',
  description:
    "Create a new Google Doc in the user's Google Drive. Use when the user asks to create a document, write a draft, or start a new doc. Optionally populate it with initial content.",
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title of the new Google Doc', maxLength: 200 },
      content: { type: 'string', description: 'Initial text content for the document', maxLength: 50000 },
    },
    required: ['title'],
  },
  inputSchema,
  requiredScopes: ['drive:write'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to create Google Docs.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Google Drive access.' };
    }

    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user?.email) {
        return { success: false, data: null, error: 'No email address associated with your account.' };
      }

      const ctx = await resolveGoogleContext(tenantId, user.email);
      const file = await createGoogleDoc(ctx, params.title, params.content);

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'admin_action',
        resource: 'createGoogleDoc',
        details: { fileId: file.id, title: params.title, tenantId },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          confirmation: `Google Doc created: "${file.name}"`,
          file: {
            id: file.id,
            name: file.name,
            link: file.webViewLink,
            mimeType: file.mimeType,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to create Google Doc: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(createGoogleDocTool);
export { createGoogleDocTool };
