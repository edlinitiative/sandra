/**
 * getWhatsAppGroups — list and inspect WhatsApp groups managed by this business number.
 *
 * Required scopes: whatsapp:groups
 *
 * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference/
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { listGroups, getGroupInfo, getGroupInviteLink } from '@/lib/channels/whatsapp-groups-api';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  action: z
    .enum(['list', 'info', 'invite_link'])
    .describe(
      'list: get all active groups. info: get details about one group. invite_link: get/retrieve the invite link for a group.',
    ),
  groupId: z
    .string()
    .optional()
    .describe('Group ID — required for action=info or action=invite_link'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(25)
    .describe('For action=list: max number of groups to return (default 25)'),
});

const getWhatsAppGroupsTool: SandraTool = {
  name: 'getWhatsAppGroups',
  description:
    "List, inspect, or retrieve invite links for WhatsApp groups. Use action='list' to see all active groups (e.g. to find a group by name). Use action='info' with a groupId to get participant count and details. Use action='invite_link' to retrieve the current invite link for a group (e.g. if you need to re-send an invitation).",
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'info', 'invite_link'],
        description: 'list | info | invite_link',
      },
      groupId: {
        type: 'string',
        description: 'Group ID (required for info and invite_link)',
      },
      limit: {
        type: 'number',
        description: 'Max groups for list action (default 25)',
        default: 25,
      },
    },
    required: ['action'],
  },
  inputSchema,
  requiredScopes: ['whatsapp:groups'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'You need to be signed in to manage WhatsApp groups.' };
    }

    try {
      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'getWhatsAppGroups',
        details: { action: params.action, groupId: params.groupId },
        success: true,
      }).catch(() => {});

      switch (params.action) {
        case 'list': {
          const result = await listGroups(params.limit ?? 25);

          if (result.groups.length === 0) {
            return {
              success: true,
              data: {
                message: 'No active WhatsApp groups found for this business number.',
                groups: [],
              },
            };
          }

          const lines = result.groups.map((g) => {
            const created = new Date(g.createdAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
            return `• **${g.subject}** — ID: \`${g.groupId}\` (created ${created})`;
          });

          return {
            success: true,
            data: {
              message: `**Active WhatsApp Groups** (${result.groups.length}):\n\n${lines.join('\n')}`,
              groups: result.groups,
              nextPageToken: result.nextPageToken,
            },
          };
        }

        case 'info': {
          if (!params.groupId) {
            return { success: false, data: null, error: 'groupId is required for action=info.' };
          }

          const info = await getGroupInfo(params.groupId);

          const participantList = info.participants.length > 0
            ? info.participants.map((p) => `  • ${p}`).join('\n')
            : '  (none yet)';

          return {
            success: true,
            data: {
              message:
                `**${info.subject}**\n` +
                `ID: \`${info.groupId}\`\n` +
                (info.description ? `Description: ${info.description}\n` : '') +
                `Participants: ${info.totalParticipantCount}\n` +
                `Join mode: ${info.joinApprovalMode}\n` +
                `Suspended: ${info.suspended ? 'Yes' : 'No'}\n\n` +
                `Participant IDs:\n${participantList}`,
              groupId: info.groupId,
              subject: info.subject,
              description: info.description,
              totalParticipantCount: info.totalParticipantCount,
              participants: info.participants,
              joinApprovalMode: info.joinApprovalMode,
              suspended: info.suspended,
            },
          };
        }

        case 'invite_link': {
          if (!params.groupId) {
            return { success: false, data: null, error: 'groupId is required for action=invite_link.' };
          }

          const link = await getGroupInviteLink(params.groupId);

          return {
            success: true,
            data: {
              message: `Invite link for group \`${params.groupId}\`:\n\n${link}`,
              groupId: params.groupId,
              inviteLink: link,
            },
          };
        }

        default:
          return { success: false, data: null, error: `Unknown action: ${params.action}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, data: null, error: `WhatsApp Groups API error: ${message}` };
    }
  },
};

toolRegistry.register(getWhatsAppGroupsTool);
