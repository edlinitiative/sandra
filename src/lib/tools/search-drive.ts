/**
 * searchDrive — search files in a tenant's connected Google Drive.
 *
 * Requires the user to be a member of a tenant with an active
 * Google Workspace provider. Results are scoped to the tenant's
 * configured Drive folders.
 *
 * Required scopes: drive:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { searchFiles, getFileContent } from '@/lib/google/drive';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(500)
    .describe('Search query — file name or content keywords'),
  maxResults: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('Maximum number of files to return'),
  includeContent: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, extract and return file text content (slower)'),
});

const searchDrive: SandraTool = {
  name: 'searchDrive',
  description:
    "Search the organization's Google Drive for files and documents. Returns file names, links, and optionally text content. Use when users ask about internal documents, policies, handbooks, or shared files.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query — file name or content keywords' },
      maxResults: { type: 'number', description: 'Max files to return (default 5)', default: 5 },
      includeContent: { type: 'boolean', description: 'Include file text content', default: false },
    },
    required: ['query'],
  },
  inputSchema,
  requiredScopes: ['drive:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to search Drive.' };
    }

    // Resolve tenant
    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Google Drive access.' };
    }

    try {
      const ctx = await resolveGoogleContext(tenantId);

      const result = await searchFiles(ctx, {
        query: params.query,
        folderIds: ctx.config.driveFolderIds,
        maxResults: params.maxResults,
      });

      let files = result.files.map((f) => ({
        name: f.name,
        type: f.mimeType,
        link: f.webViewLink,
        modified: f.modifiedTime,
        content: undefined as string | undefined,
      }));

      // Optionally fetch content
      if (params.includeContent && result.files.length > 0) {
        for (let i = 0; i < result.files.length; i++) {
          const driveFile = result.files[i];
          if (!driveFile) continue;
          try {
            const content = await getFileContent(ctx, driveFile);
            files[i] = { ...files[i]!, content: content.text.slice(0, 2000) };
          } catch {
            files[i] = { ...files[i]!, content: '[Could not extract content]' };
          }
        }
      }

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'searchDrive',
        details: { query: params.query, resultCount: files.length, tenantId },
        success: true,
      }).catch(() => {});

      if (files.length === 0) {
        return { success: true, data: { message: `No files found matching "${params.query}".`, files: [] } };
      }

      return {
        success: true,
        data: {
          message: `Found ${files.length} file(s) matching "${params.query}".`,
          files,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to search Drive',
      };
    }
  },
};

toolRegistry.register(searchDrive);
