/**
 * createWhatsAppGroup — create a new WhatsApp group via the Meta Business Groups API.
 *
 * Groups are invite-only: after creation an invite link is returned which you
 * can send to prospective members (use sendWhatsAppGroupInvite for that).
 * Max participants per group: 8
 *
 * Required scopes: whatsapp:groups
 *
 * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference/
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { createGroup } from '@/lib/channels/whatsapp-groups-api';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  subject: z
    .string()
    .min(1)
    .max(128)
    .describe('Group name/subject, e.g. "ESLP 2026 Cohort" or "ESLP 2026 — Social Projects Team A"'),
  description: z
    .string()
    .max(2048)
    .optional()
    .describe('Optional group description visible to members before joining'),
  joinApprovalMode: z
    .enum(['auto_approve', 'approval_required'])
    .optional()
    .default('auto_approve')
    .describe(
      'auto_approve: anyone with the link can join immediately. ' +
      'approval_required: join requests must be manually approved. ' +
      'Use auto_approve for accepted cohort members who you will personally invite.',
    ),
});

const createWhatsAppGroupTool: SandraTool = {
  name: 'createWhatsAppGroup',
  description:
    "Create a new WhatsApp group for a cohort, program, or team. Returns the group ID and an invite link you can send to members. Use sendWhatsAppGroupInvite after this to invite specific people. For ESLP: create the main cohort group first, then create separate sub-groups for social project teams. Groups are invite-only — participants join by tapping the link. Max 8 members per group. Requires WhatsApp Business to be configured and an Official Business Account.",
  parameters: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: 'Group name, e.g. "ESLP 2026 Cohort" or "ESLP 2026 — Team A"',
        maxLength: 128,
      },
      description: {
        type: 'string',
        description: 'Optional description shown to users before joining',
        maxLength: 2048,
      },
      joinApprovalMode: {
        type: 'string',
        enum: ['auto_approve', 'approval_required'],
        description: 'auto_approve (default) or approval_required',
        default: 'auto_approve',
      },
    },
    required: ['subject'],
  },
  inputSchema,
  requiredScopes: ['whatsapp:groups'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'You need to be signed in to create WhatsApp groups.' };
    }

    try {
      const result = await createGroup({
        subject: params.subject,
        description: params.description,
        joinApprovalMode: params.joinApprovalMode ?? 'auto_approve',
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'createWhatsAppGroup',
        details: {
          groupId: result.groupId,
          subject: result.subject,
          joinApprovalMode: result.joinApprovalMode,
        },
        success: true,
      }).catch(() => {});

      const approvalNote =
        result.joinApprovalMode === 'approval_required'
          ? '\n\n⚠️ Join approval is required — you\'ll need to approve each join request.'
          : '\n\nAnyone with the link can join immediately.';

      return {
        success: true,
        data: {
          message:
            `WhatsApp group created: **${result.subject}**\n\n` +
            `🆔 Group ID: \`${result.groupId}\`\n` +
            `🔗 Invite link: ${result.inviteLink}${approvalNote}\n\n` +
            `Use this invite link to add members. You can send it individually with sendWhatsAppGroupInvite, or share it directly.`,
          groupId: result.groupId,
          subject: result.subject,
          description: result.description,
          inviteLink: result.inviteLink,
          joinApprovalMode: result.joinApprovalMode,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('WHATSAPP_') || message.includes('not configured')) {
        return {
          success: false,
          data: null,
          error: 'WhatsApp Business is not configured on this server. Check that WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN are set.',
        };
      }

      if (message.includes('190') || message.includes('token')) {
        return {
          success: false,
          data: null,
          error: 'WhatsApp access token is invalid or expired. Please refresh the token in the Meta Business Manager.',
        };
      }

      return { success: false, data: null, error: `Couldn't create WhatsApp group: ${message}` };
    }
  },
};

toolRegistry.register(createWhatsAppGroupTool);
