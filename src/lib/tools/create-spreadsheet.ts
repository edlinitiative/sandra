/**
 * createSpreadsheet — create a new Google Sheet in the user's Drive.
 *
 * Required scopes: drive:write
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { createGoogleSheet } from '@/lib/google/drive';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('Title (name) for the new Google Sheet'),
  headers: z
    .array(z.string())
    .max(26)
    .optional()
    .describe('Optional column headers for the first row, e.g. ["Name", "Email", "Status"]'),
});

const createSpreadsheetTool: SandraTool = {
  name: 'createSpreadsheet',
  description:
    "Create a new Google Sheet (spreadsheet) in the user's Google Drive. Use when the user asks to create a spreadsheet, table, tracker, or grid. Optionally set column headers for the first row.",
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title of the new Google Sheet', maxLength: 200 },
      headers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Column headers for the first row',
        maxItems: 26,
      },
    },
    required: ['title'],
  },
  inputSchema,
  requiredScopes: ['drive:write'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to create Google Sheets.' };
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
      const initialRows = params.headers?.length ? [params.headers] : undefined;
      const file = await createGoogleSheet(ctx, params.title, initialRows);

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'admin_action',
        resource: 'createSpreadsheet',
        details: { fileId: file.id, title: params.title, tenantId },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          confirmation: `Spreadsheet created: "${file.name}"`,
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
        error: `Failed to create spreadsheet: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(createSpreadsheetTool);
export { createSpreadsheetTool };
