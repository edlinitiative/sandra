/**
 * impersonateUserSession — read-only support view of a user's context.
 *
 * Allows support staff / admins to inspect a user's profile, memory entries,
 * and recent sessions WITHOUT gaining write access. Fully audit-logged.
 *
 * Required scopes: admin:tools
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';
import { getUserMemoryStore } from '@/lib/memory/user-memory';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  email: z.string().email().describe("Email address of the user to inspect."),
  include: z
    .array(z.enum(['profile', 'memory', 'sessions', 'audit']))
    .optional()
    .default(['profile', 'memory', 'sessions'])
    .describe("Which data sections to include. Default: profile, memory, sessions."),
});

const impersonateUserSessionTool: SandraTool = {
  name: 'impersonateUserSession',
  description:
    "Read-only support view: inspect a user's profile, memory notes, and recent chat sessions. Used by support staff or admins to troubleshoot issues. Does NOT give write access or allow acting as the user. ADMIN ONLY.",
  parameters: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email', description: "Email of the user to inspect" },
      include: {
        type: 'array',
        items: { type: 'string', enum: ['profile', 'memory', 'sessions', 'audit'] },
        description: "Sections to include",
      },
    },
    required: ['email'],
  },
  inputSchema,
  requiredScopes: ['admin:tools'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const adminUserId = context.userId;

    if (!adminUserId) {
      return { success: false, data: null, error: 'Authentication required.' };
    }

    // Audit every invocation immediately — even before we do anything
    await logAuditEvent({
      userId: adminUserId,
      sessionId: context.sessionId,
      action: 'admin_action',
      resource: 'impersonateUserSession',
      details: {
        targetEmail: params.email,
        include: params.include,
        note: 'READ-ONLY support view — no write access granted',
      },
      success: true,
    }).catch(() => {});

    try {
      const user = await db.user.findUnique({
        where: { email: params.email },
        select: {
          id: true, name: true, email: true, role: true,
          language: true, channel: true, createdAt: true,
          tenantMembers: {
            where: { isActive: true },
            select: { tenantId: true, role: true },
          },
        },
      });

      if (!user) {
        return { success: false, data: null, error: `No user found with email ${params.email}.` };
      }

      const result: Record<string, unknown> = { userId: user.id };
      const sections = params.include ?? ['profile', 'memory', 'sessions'];

      if (sections.includes('profile')) {
        result.profile = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          language: user.language,
          channel: user.channel,
          createdAt: user.createdAt.toISOString().substring(0, 10),
          tenants: user.tenantMembers,
        };
      }

      if (sections.includes('memory')) {
        const memoryStore = getUserMemoryStore();
        const memories = await memoryStore.getMemories(user.id);
        result.memory = memories.map((m) => ({
          key: m.key,
          value: m.value,
          source: m.source,
          confidence: m.confidence,
        }));
      }

      if (sections.includes('sessions')) {
        // Get recent sessions from ActionRequest as a proxy (sessions aren't persisted separately)
        const recentActions = await db.actionRequest.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, tool: true, status: true, channel: true,
            createdAt: true, input: true,
          },
        });
        result.recentActions = recentActions.map((a) => ({
          id: a.id,
          tool: a.tool,
          status: a.status,
          channel: a.channel,
          createdAt: a.createdAt.toISOString(),
        }));
      }

      if (sections.includes('audit')) {
        const auditLogs = await db.auditLog.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            action: true, resource: true, success: true, createdAt: true,
          },
        });
        result.auditLog = auditLogs.map((l) => ({
          action: l.action,
          resource: l.resource,
          success: l.success,
          createdAt: l.createdAt.toISOString(),
        }));
      }

      return {
        success: true,
        data: {
          note: 'READ-ONLY view. No write access has been granted.',
          ...result,
        },
      };
    } catch (error) {
      await logAuditEvent({
        userId: adminUserId,
        sessionId: context.sessionId,
        action: 'admin_action',
        resource: 'impersonateUserSession',
        details: { targetEmail: params.email, error: String(error) },
        success: false,
      }).catch(() => {});

      return {
        success: false,
        data: null,
        error: `Failed to retrieve user session: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(impersonateUserSessionTool);
export { impersonateUserSessionTool };
