/**
 * Tool: getUserProfileSummary
 *
 * Returns the authenticated user's profile information including
 * name, email, role, language preferences, and stored memories.
 *
 * Requires: profile:read scope (student+ role)
 */
import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';
import { getUserMemoryStore } from '@/lib/memory/user-memory';

const inputSchema = z.object({}).strict();

const getUserProfileTool: SandraTool = {
  name: 'getUserProfileSummary',
  description:
    'Retrieve the authenticated user\'s profile summary including name, role, language, enrollment count, certificate count, and known preferences. Only works for signed-in users.',
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  inputSchema,
  requiredScopes: ['profile:read'],

  async handler(_input: unknown, context: ToolContext): Promise<ToolResult> {
    if (!context.userId) {
      return {
        success: false,
        data: null,
        error: 'User is not authenticated. Please sign in to access your profile.',
      };
    }

    try {
      const user = await db.user.findUnique({
        where: { id: context.userId },
        include: {
          _count: {
            select: {
              enrollments: true,
              certificates: true,
              applications: true,
            },
          },
        },
      });

      if (!user) {
        return {
          success: false,
          data: null,
          error: 'User profile not found.',
        };
      }

      // Load user memories (preferences, facts)
      const memoryStore = getUserMemoryStore();
      const memories = await memoryStore.getMemories(user.id);
      const preferences = Object.fromEntries(
        memories.map((m) => [m.key, m.value]),
      );

      // Resolve effective email (channel users have no email column; fall back to workspaceEmail)
      const effectiveEmail = user.email ?? context.workspaceEmail ?? null;

      // Resolve TenantMember role — more accurate than User.role for org members
      let memberRole: string | null = null;
      if (effectiveEmail) {
        const membership = await db.tenantMember.findFirst({
          where: { user: { email: effectiveEmail }, isActive: true },
          select: { role: true },
        });
        memberRole = membership?.role ?? null;
      }

      return {
        success: true,
        data: {
          name: user.name ?? 'Not set',
          email: effectiveEmail ?? 'Not set',
          role: memberRole ?? user.role,
          language: user.language,
          channel: user.channel,
          enrollmentCount: user._count.enrollments,
          certificateCount: user._count.certificates,
          applicationCount: user._count.applications,
          preferences,
          memberSince: user.createdAt.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to load profile: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(getUserProfileTool);
export default getUserProfileTool;
