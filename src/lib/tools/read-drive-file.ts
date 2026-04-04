/**
 * readDriveFile — read the full text content of a specific Drive file by ID.
 *
 * Required scopes: drive:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { getFileById, getFileContent } from '@/lib/google/drive';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  fileId: z
    .string()
    .min(1)
    .describe('The Google Drive file ID to read'),
  maxLength: z
    .number()
    .int()
    .min(100)
    .max(20000)
    .optional()
    .default(8000)
    .describe('Maximum characters of content to return (default 8000)'),
});

const readDriveFileTool: SandraTool = {
  name: 'readDriveFile',
  description:
    "Read the full text content of a specific Google Drive file (Google Doc, Sheet, presentation, or text file) by its file ID. Use when the user asks to open, read, or summarize a specific document. Use searchDrive first to find the file ID if the user only gives a name.",
  parameters: {
    type: 'object',
    properties: {
      fileId: { type: 'string', description: 'Google Drive file ID' },
      maxLength: { type: 'number', description: 'Max content characters to return (default 8000)', default: 8000 },
    },
    required: ['fileId'],
  },
  inputSchema,
  requiredScopes: ['drive:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to read Drive files.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Google Drive access.' };
    }

    try {
      const rawCtx = await resolveGoogleContext(tenantId);
      const ctx = rawCtx.config.driveImpersonateEmail
        ? { ...rawCtx, impersonateEmail: rawCtx.config.driveImpersonateEmail }
        : rawCtx;

      const file = await getFileById(ctx, params.fileId);
      const content = await getFileContent(ctx, file);

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'readDriveFile',
        details: { fileId: params.fileId, fileName: file.name, tenantId },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          file: {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            link: file.webViewLink,
            modified: file.modifiedTime,
          },
          content: content.text.slice(0, params.maxLength),
          extractionMethod: content.extractionMethod,
          truncated: content.text.length > params.maxLength,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(readDriveFileTool);
export { readDriveFileTool };
