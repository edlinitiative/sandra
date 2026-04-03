/**
 * shareDriveFile — share a Google Drive file or folder with a user.
 *
 * Required scopes: drive:write
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { shareFile, getFileById } from '@/lib/google/drive';
import { actionRateLimiter } from '@/lib/actions/rate-limiter';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  fileId: z
    .string()
    .min(1)
    .describe('The Google Drive file or folder ID to share'),
  email: z
    .string()
    .email()
    .describe('The email address of the person to share with'),
  role: z
    .enum(['reader', 'commenter', 'writer'])
    .optional()
    .default('reader')
    .describe("Permission level: 'reader' (view), 'commenter' (view + comment), 'writer' (edit). Default: reader."),
  sendNotification: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to send an email notification to the recipient. Default: true.'),
});

const shareDriveFileTool: SandraTool = {
  name: 'shareDriveFile',
  description:
    "Share a Google Drive file or folder with another person by email. Use when the user asks to share a document, give access to a file, or add a collaborator. First use searchDrive to find the file ID if needed.",
  parameters: {
    type: 'object',
    properties: {
      fileId: { type: 'string', description: 'Drive file or folder ID' },
      email: { type: 'string', format: 'email', description: 'Email of the person to share with' },
      role: {
        type: 'string',
        enum: ['reader', 'commenter', 'writer'],
        description: "Access level: 'reader', 'commenter', or 'writer'",
        default: 'reader',
      },
      sendNotification: { type: 'boolean', description: 'Send email notification to recipient', default: true },
    },
    required: ['fileId', 'email'],
  },
  inputSchema,
  requiredScopes: ['drive:write'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to share Drive files.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Google Drive access.' };
    }

    if (!actionRateLimiter.consume(userId, 'shareDriveFile')) {
      return { success: false, data: null, error: 'Rate limit reached. Please wait a few minutes.' };
    }

    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user?.email) {
        return { success: false, data: null, error: 'No email address associated with your account.' };
      }

      const ctx = await resolveGoogleContext(tenantId, user.email);
      const file = await getFileById(ctx, params.fileId);
      const permission = await shareFile(ctx, params.fileId, params.email, params.role, params.sendNotification);

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'admin_action',
        resource: 'shareDriveFile',
        details: { fileId: params.fileId, fileName: file.name, sharedWith: params.email, role: params.role, tenantId },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          confirmation: `"${file.name}" shared with ${params.email} as ${params.role}.`,
          file: { id: file.id, name: file.name, link: file.webViewLink },
          permission,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to share file: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(shareDriveFileTool);
export { shareDriveFileTool };
