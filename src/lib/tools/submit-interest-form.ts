/**
 * submitInterestForm — let a user express interest in a specific EdLight
 * program (ESLP, Nexus, Academy Scholarship, etc.). Creates a ProgramApplication
 * record in the database with status "submitted".
 *
 * Required scopes: actions:submit
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';
import { enqueueAction } from '@/lib/actions/queue';
import { actionRateLimiter } from '@/lib/actions/rate-limiter';
import { logAuditEvent } from '@/lib/audit';

const KNOWN_PROGRAMS = [
  'ESLP',
  'Nexus',
  'Academy Scholarship',
  'Code Scholarship',
  'EdLight Initiative Grant',
  'Educator Partnership',
  'Corporate Partnership',
] as const;

const inputSchema = z.object({
  programName: z
    .string()
    .min(2)
    .describe('Name of the EdLight program to apply for (e.g. "ESLP", "Nexus", "Academy Scholarship")'),
  applicantName: z
    .string()
    .optional()
    .describe('Full name of the applicant'),
  motivation: z
    .string()
    .max(1000)
    .optional()
    .describe('Why the applicant is interested in this program (max 1000 characters)'),
});

const submitInterestForm: SandraTool = {
  name: 'submitInterestForm',
  description:
    'Submit a formal expression of interest in an EdLight program (ESLP, Nexus, Academy Scholarship, etc.). Use this when a user explicitly asks to apply for or express interest in a named program. Creates a ProgramApplication record.',
  parameters: {
    type: 'object',
    properties: {
      programName:   { type: 'string', description: `Program name. Known programs: ${KNOWN_PROGRAMS.join(', ')}` },
      applicantName: { type: 'string', description: 'Full name of the applicant' },
      motivation:    { type: 'string', description: 'Why interested in this program (max 1000 chars)', maxLength: 1000 },
    },
    required: ['programName'],
  },
  inputSchema,
  requiredScopes: ['actions:submit'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId ?? context.sessionId;

    // Rate limit: max 5 form submissions per user per 10 min
    if (!actionRateLimiter.consume(userId, 'submitInterestForm')) {
      return { success: false, data: null, error: 'Too many submissions. Please wait a few minutes.' };
    }

    // Create ProgramApplication record if we have a real userId
    let applicationId: string | undefined;
    if (context.userId) {
      const application = await db.programApplication.create({
        data: {
          userId:      context.userId,
          programName: params.programName,
          status:      'submitted',
          metadata:    {
            applicantName: params.applicantName ?? null,
            motivation:    params.motivation ?? null,
            submittedVia:  'sandra',
          },
        },
      });
      applicationId = application.id;
    }

    // Always queue an action record for audit/admin visibility
    const result = await enqueueAction({
      userId:           context.userId,
      sessionId:        context.sessionId,
      channel:          'web',
      tool:             'submitInterestForm',
      input:            params as Record<string, unknown>,
      requiresApproval: false,
      metadata:         { applicationId: applicationId ?? null },
    });

    await logAuditEvent({
      userId:    context.userId,
      sessionId: context.sessionId,
      action:    'data_access',
      resource:  'submitInterestForm',
      details:   { programName: params.programName, applicationId, actionId: result.actionId },
      success:   true,
    });

    return {
      success: true,
      data: {
        actionId:      result.actionId,
        applicationId: applicationId ?? null,
        programName:   params.programName,
        status:        'submitted',
        message:       `Your expression of interest for the ${params.programName} program has been submitted. The EdLight team will review your application and reach out with next steps.`,
      },
    };
  },
};

toolRegistry.register(submitInterestForm);
export { submitInterestForm };
