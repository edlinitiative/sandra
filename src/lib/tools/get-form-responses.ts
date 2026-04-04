/**
 * getFormResponses — read submissions from a Google Form.
 *
 * Returns a structured summary of all responses: respondent email,
 * submission time, and a map of question → answer for each submission.
 *
 * Common use cases:
 *   - Reviewing ESLP applicant submissions
 *   - Summarising survey results
 *   - Checking who has applied to a program
 *
 * Required scopes: forms:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { getFormResponses } from '@/lib/google/forms';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  formId: z
    .string()
    .min(1)
    .describe('The Google Form ID. Found in the form URL: docs.google.com/forms/d/<FORM_ID>/edit'),
  maxResponses: z
    .number()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe('Maximum number of responses to return. Default 100.'),
  summaryOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, return only a count + respondent list without full answer details. Useful for a quick "how many people applied?" check.',
    ),
});

const getFormResponsesTool: SandraTool = {
  name: 'getFormResponses',
  description:
    "Read submissions from a Google Form. Use when the user wants to review applications, check who submitted a form, or analyse survey results. Returns respondent emails, submission times, and all question answers. To find the form ID, search Drive first for the form by name. Use summaryOnly=true for a quick count.",
  parameters: {
    type: 'object',
    properties: {
      formId: {
        type: 'string',
        description: 'Google Form ID from the form URL',
      },
      maxResponses: {
        type: 'number',
        description: 'Max responses to return (default 100)',
        default: 100,
      },
      summaryOnly: {
        type: 'boolean',
        description: 'Return only count + respondent list, not full answers',
        default: false,
      },
    },
    required: ['formId'],
  },
  inputSchema,
  requiredScopes: ['forms:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'You need to be signed in to read form responses.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'Your account is not linked to a Workspace with Google Forms access.' };
    }

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    const userEmail = user?.email ?? null;

    if (!userEmail) {
      return { success: false, data: null, error: 'No email address found. Say "my email is you@edlight.org" to link your account first.' };
    }

    try {
      const ctx = await resolveGoogleContext(tenantId, userEmail);

      const result = await getFormResponses(ctx, params.formId, params.maxResponses ?? 100);

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'getFormResponses',
        details: {
          formId: params.formId,
          formTitle: result.formTitle,
          responseCount: result.totalResponses,
          tenantId,
        },
        success: true,
      }).catch(() => {});

      if (params.summaryOnly) {
        const respondents = result.responses
          .map((r) => r.respondentEmail ?? `Anonymous (${r.responseId.slice(0, 8)})`)
          .join('\n');

        return {
          success: true,
          data: {
            message: `"${result.formTitle}" has ${result.totalResponses} response${result.totalResponses !== 1 ? 's' : ''}.\n\nRespondents:\n${respondents || '(none yet)'}`,
            formId: params.formId,
            formTitle: result.formTitle,
            totalResponses: result.totalResponses,
          },
        };
      }

      // Full response data
      const summaryLines = result.responses.map((r, i) => {
        const who = r.respondentEmail ?? `Respondent ${i + 1}`;
        const when = new Date(r.submittedAt).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        });
        const answerParts = Object.entries(r.answers)
          .slice(0, 5) // cap for readability
          .map(([q, a]) => `  • ${q}: ${Array.isArray(a) ? a.join(', ') : a}`)
          .join('\n');

        return `**${who}** — submitted ${when}\n${answerParts}`;
      });

      const preview = summaryLines.slice(0, 10).join('\n\n');
      const truncNote = result.totalResponses > 10 ? `\n\n_(Showing 10 of ${result.totalResponses} responses)_` : '';

      return {
        success: true,
        data: {
          message: `**${result.formTitle}** — ${result.totalResponses} response${result.totalResponses !== 1 ? 's' : ''}\n\n${preview || '(No responses yet)'}${truncNote}`,
          formId: params.formId,
          formTitle: result.formTitle,
          totalResponses: result.totalResponses,
          responses: result.responses,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('403')) {
        return {
          success: false,
          data: null,
          error: 'Forms API access is not yet enabled. A Super Admin needs to grant the forms.responses.readonly scope under Domain-wide Delegation in Google Admin Console.',
        };
      }

      return { success: false, data: null, error: `Couldn't read form responses: ${message}` };
    }
  },
};

toolRegistry.register(getFormResponsesTool);
