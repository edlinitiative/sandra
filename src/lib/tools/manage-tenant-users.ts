/**
 * manageTenantUsers — invite or remove users from a tenant.
 *
 * Admins can invite new members to their tenant (creates TenantMember record)
 * or deactivate existing members.
 *
 * Required scopes: admin:tools
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';
import { getTenantRole, resolveTenantForUser } from '@/lib/google/context';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  action: z
    .enum(['invite', 'remove', 'list', 'change-role'])
    .describe("Action: 'invite' a new member, 'remove' (deactivate) a member, 'list' all members, or 'change-role'"),
  email: z
    .string()
    .email()
    .optional()
    .describe("Target user's email address (required for invite/remove/change-role)"),
  role: z
    .enum(['basic', 'manager', 'admin'])
    .optional()
    .describe("Role to assign: 'basic', 'manager', or 'admin' (required for invite/change-role)"),
});

const manageTenantUsersTool: SandraTool = {
  name: 'manageTenantUsers',
  description:
    "Manage users in your organization tenant: invite new members, remove existing ones, change roles, or list all members. ADMIN ONLY. Use when an admin asks to add someone to their organization, remove access, or view team members.",
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['invite', 'remove', 'list', 'change-role'],
        description: "Action to perform",
      },
      email: { type: 'string', format: 'email', description: 'Target user email' },
      role: {
        type: 'string',
        enum: ['basic', 'manager', 'admin'],
        description: 'Role to assign',
      },
    },
    required: ['action'],
  },
  inputSchema,
  requiredScopes: ['admin:tools'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required for tenant management.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any tenant.' };
    }

    // Verify the caller is an admin
    const callerRole = await getTenantRole(tenantId, userId);
    if (callerRole !== 'admin') {
      return { success: false, data: null, error: 'Only tenant admins can manage users.' };
    }

    try {
      switch (params.action) {
        case 'list': {
          const members = await db.tenantMember.findMany({
            where: { tenantId, isActive: true },
            include: { user: { select: { name: true, email: true, createdAt: true } } },
            orderBy: { createdAt: 'asc' },
          });
          return {
            success: true,
            data: {
              tenantId,
              memberCount: members.length,
              members: members.map((m) => ({
                userId: m.userId,
                name: m.user.name,
                email: m.user.email,
                role: m.role,
                joinedAt: m.createdAt.toISOString().substring(0, 10),
              })),
            },
          };
        }

        case 'invite': {
          if (!params.email) return { success: false, data: null, error: 'Email is required to invite a user.' };
          const role = params.role ?? 'basic';

          // Find or create user
          let user = await db.user.findUnique({ where: { email: params.email } });
          if (!user) {
            user = await db.user.create({
              data: { email: params.email, role: 'student' },
            });
          }

          // Upsert membership
          const membership = await db.tenantMember.upsert({
            where: { tenantId_userId: { tenantId, userId: user.id } },
            update: { role, isActive: true },
            create: { tenantId, userId: user.id, role },
          });

          await logAuditEvent({
            userId, sessionId: context.sessionId, action: 'admin_action',
            resource: 'manageTenantUsers',
            details: { action: 'invite', targetEmail: params.email, role, tenantId },
            success: true,
          }).catch(() => {});

          return {
            success: true,
            data: {
              confirmation: `${params.email} has been invited as ${role} to your organization.`,
              membership: { userId: user.id, email: user.email, role: membership.role },
            },
          };
        }

        case 'remove': {
          if (!params.email) return { success: false, data: null, error: 'Email is required to remove a user.' };

          const user = await db.user.findUnique({ where: { email: params.email } });
          if (!user) return { success: false, data: null, error: `No user found with email ${params.email}.` };

          await db.tenantMember.updateMany({
            where: { tenantId, userId: user.id },
            data: { isActive: false },
          });

          await logAuditEvent({
            userId, sessionId: context.sessionId, action: 'admin_action',
            resource: 'manageTenantUsers',
            details: { action: 'remove', targetEmail: params.email, tenantId },
            success: true,
          }).catch(() => {});

          return {
            success: true,
            data: { confirmation: `${params.email} has been removed from your organization.` },
          };
        }

        case 'change-role': {
          if (!params.email) return { success: false, data: null, error: 'Email is required to change a role.' };
          if (!params.role) return { success: false, data: null, error: 'Role is required to change a role.' };

          const user = await db.user.findUnique({ where: { email: params.email } });
          if (!user) return { success: false, data: null, error: `No user found with email ${params.email}.` };

          await db.tenantMember.updateMany({
            where: { tenantId, userId: user.id },
            data: { role: params.role },
          });

          await logAuditEvent({
            userId, sessionId: context.sessionId, action: 'admin_action',
            resource: 'manageTenantUsers',
            details: { action: 'change-role', targetEmail: params.email, newRole: params.role, tenantId },
            success: true,
          }).catch(() => {});

          return {
            success: true,
            data: { confirmation: `${params.email}'s role updated to ${params.role}.` },
          };
        }

        default:
          return { success: false, data: null, error: 'Unknown action.' };
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to manage tenant users: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(manageTenantUsersTool);
export { manageTenantUsersTool };
