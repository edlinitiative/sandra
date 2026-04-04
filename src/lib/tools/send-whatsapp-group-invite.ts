/**
 * sendWhatsAppGroupInvite — send a WhatsApp group invite link to one or more users.
 *
 * Sends a plain-text message containing the group invite link to each
 * specified phone number. Users tap the link to join the group.
 *
 * Use after createWhatsAppGroup to invite accepted applicants (e.g. ESLP cohort members).
 * For sub-groups (e.g. social project teams), use this to invite specific sub-sets.
 *
 * Required scopes: whatsapp:groups
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { sendInviteLinkToUser, getGroupInviteLink } from '@/lib/channels/whatsapp-groups-api';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  groupId: z
    .string()
    .min(1)
    .describe('The WhatsApp group ID to invite users to'),
  groupSubject: z
    .string()
    .min(1)
    .max(128)
    .describe('Group name shown in the invite message, e.g. "ESLP 2026 Cohort"'),
  recipients: z
    .array(
      z.object({
        phoneNumber: z
          .string()
          .min(7)
          .describe('Phone number in international format, e.g. "+50912345678" or "50912345678"'),
        name: z
          .string()
          .optional()
          .describe('Recipient name for personalising the message'),
      }),
    )
    .min(1)
    .max(50)
    .describe('List of people to invite. Each entry needs a phone number.'),
  personalNote: z
    .string()
    .max(500)
    .optional()
    .describe(
      'Optional opening line prepended to the invite message, e.g. "Congratulations — you\'ve been accepted to ESLP 2026! 🎉"',
    ),
  inviteLink: z
    .string()
    .url()
    .optional()
    .describe(
      'The invite link. If not provided, it will be fetched automatically from the group using groupId.',
    ),
});

const sendWhatsAppGroupInviteTool: SandraTool = {
  name: 'sendWhatsAppGroupInvite',
  description:
    "Send a WhatsApp group invite link to a list of phone numbers. Use after createWhatsAppGroup to invite accepted applicants or team members. Each person receives a WhatsApp message with the group invite link. You can add a personalNote like a congratulations message. For ESLP: call this once for the main cohort group, then again for each sub-group (social project teams) with the relevant subset of phone numbers. Always provide the groupId so the link is fetched automatically.",
  parameters: {
    type: 'object',
    properties: {
      groupId: {
        type: 'string',
        description: 'WhatsApp group ID',
      },
      groupSubject: {
        type: 'string',
        description: 'Group name shown in the message',
        maxLength: 128,
      },
      recipients: {
        type: 'array',
        description: 'People to invite (phone number + optional name)',
        items: {
          type: 'object',
          properties: {
            phoneNumber: {
              type: 'string',
              description: 'International phone number, e.g. "+50912345678"',
            },
            name: {
              type: 'string',
              description: 'Optional name for personalisation',
            },
          },
          required: ['phoneNumber'],
        },
      },
      personalNote: {
        type: 'string',
        description: 'Optional opening line, e.g. a congratulations message',
        maxLength: 500,
      },
      inviteLink: {
        type: 'string',
        description: 'Invite link (auto-fetched from groupId if omitted)',
        format: 'uri',
      },
    },
    required: ['groupId', 'groupSubject', 'recipients'],
  },
  inputSchema,
  requiredScopes: ['whatsapp:groups'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'You need to be signed in to send WhatsApp group invites.' };
    }

    try {
      // Resolve the invite link if not provided
      const inviteLink = params.inviteLink ?? await getGroupInviteLink(params.groupId);

      const results: Array<{ phone: string; name?: string; success: boolean; error?: string }> = [];

      for (const recipient of params.recipients) {
        try {
          // Build a personalised note if the recipient has a name
          let note = params.personalNote ?? undefined;
          if (recipient.name && params.personalNote) {
            note = `Hi ${recipient.name}! ${params.personalNote}`;
          } else if (recipient.name && !params.personalNote) {
            note = `Hi ${recipient.name}!`;
          }

          await sendInviteLinkToUser(
            recipient.phoneNumber,
            inviteLink,
            params.groupSubject,
            note,
          );

          results.push({ phone: recipient.phoneNumber, name: recipient.name, success: true });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          results.push({ phone: recipient.phoneNumber, name: recipient.name, success: false, error: errMsg });
        }
      }

      const sent = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'sendWhatsAppGroupInvite',
        details: {
          groupId: params.groupId,
          groupSubject: params.groupSubject,
          totalRecipients: params.recipients.length,
          sent: sent.length,
          failed: failed.length,
        },
        success: sent.length > 0,
      }).catch(() => {});

      const sentLine = sent.length > 0
        ? `✅ Sent to ${sent.length} ${sent.length === 1 ? 'person' : 'people'}: ${sent.map((r) => r.name ?? r.phone).join(', ')}`
        : '';

      const failedLine = failed.length > 0
        ? `\n❌ Failed for ${failed.length}: ${failed.map((r) => `${r.name ?? r.phone} (${r.error})`).join(', ')}`
        : '';

      return {
        success: sent.length > 0,
        data: {
          message: `Invites sent for **${params.groupSubject}**:\n\n${sentLine}${failedLine}`,
          groupId: params.groupId,
          inviteLink,
          sent: sent.length,
          failed: failed.length,
          results,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, data: null, error: `Couldn't send group invites: ${message}` };
    }
  },
};

toolRegistry.register(sendWhatsAppGroupInviteTool);
