/**
 * listContacts — list or search the organization's Google Workspace directory.
 *
 * Returns directory users (name, email, department, title).
 * Scoped to the tenant's Workspace domain.
 *
 * Required scopes: contacts:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { listUsers, getUserByEmail } from '@/lib/google/directory';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  query: z
    .string()
    .max(200)
    .optional()
    .describe('Search query — name, email, or department keyword'),
  email: z
    .string()
    .email()
    .optional()
    .describe('Look up a specific user by email address'),
  maxResults: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum contacts to return'),
});

const listContacts: SandraTool = {
  name: 'listContacts',
  description:
    "Search or list people in the organization's directory. Returns names, emails, departments, and titles. Use when users ask about team members, colleagues, or who works in a department.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search by name, email, or department' },
      email: { type: 'string', format: 'email', description: 'Look up a specific user by email' },
      maxResults: { type: 'number', description: 'Max contacts to return (default 10)', default: 10 },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['contacts:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to access the directory.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with directory access.' };
    }

    try {
      const ctx = await resolveGoogleContext(tenantId);

      // Single user lookup by email
      if (params.email) {
        const user = await getUserByEmail(ctx, params.email);
        if (!user) {
          return { success: true, data: { message: `No user found with email ${params.email}.`, contacts: [] } };
        }
        return {
          success: true,
          data: {
            message: `Found user: ${user.name}`,
            contacts: [{
              name: user.name,
              email: user.email,
              department: user.department,
              title: user.title,
              phone: user.phone,
            }],
          },
        };
      }

      // Directory search/list
      const result = await listUsers(ctx, {
        query: params.query,
        maxResults: params.maxResults,
      });

      const contacts = result.users
        .filter((u) => !u.suspended)
        .map((u) => ({
          name: u.name,
          email: u.email,
          department: u.department,
          title: u.title,
          phone: u.phone,
        }));

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'listContacts',
        details: { query: params.query ?? params.email, resultCount: contacts.length, tenantId },
        success: true,
      }).catch(() => {});

      if (contacts.length === 0) {
        return { success: true, data: { message: 'No contacts found matching your search.', contacts: [] } };
      }

      return {
        success: true,
        data: {
          message: `Found ${contacts.length} contact(s).`,
          contacts,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to access directory',
      };
    }
  },
};

toolRegistry.register(listContacts);
