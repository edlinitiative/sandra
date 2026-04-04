/**
 * submitApplication — record a program application for the user.
 *
 * Creates a ProgramApplication record and queues a notification.
 * Requires the user to be authenticated.
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

const KNOWN_PROGRAMS = ['ESLP', 'Nexus', 'Academy', 'Code', 'Labs'] as const;

const inputSchema = z.object({
  programName: z
    .string()
    .min(2)
    .max(100)
    .describe("Name of the EdLight program to apply to, e.g. 'ESLP', 'Nexus', 'Labs'"),
  programId: z
    .string()
    .optional()
    .describe('Optional program ID if known'),
  notes: z
    .string()
    .max(1000)
    .optional()
    .describe('Any notes or motivational statement from the applicant'),
});

const submitApplicationTool: SandraTool = {
  name: 'submitApplication',
  description:
    "Record an application for an EdLight program (ESLP, Nexus, Labs, etc.). Use when the user explicitly says they want to apply, are interested in joining a program, or asks to start an application. Only works for authenticated users.",
  parameters: {
    type: 'object',
    properties: {
      programName: { type: 'string', description: "Program name: 'ESLP', 'Nexus', 'Labs', etc." },
      programId: { type: 'string', description: 'Optional program ID' },
      notes: { type: 'string', description: 'Motivation or notes from the applicant', maxLength: 1000 },
    },
    required: ['programName'],
  },
  inputSchema,
  requiredScopes: ['actions:submit'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return {
        success: false,
        data: null,
        error: 'You need to be signed in to submit a program application.',
      };
    }

    // Rate limit: max 3 applications per 10 min
    if (!actionRateLimiter.consume(userId, 'submitApplication')) {
      return { success: false, data: null, error: 'Too many applications submitted. Please wait a few minutes.' };
    }

    try {
      // Check for duplicate
      const existing = await db.programApplication.findFirst({
        where: {
          userId,
          programName: { contains: params.programName, mode: 'insensitive' },
          status: { in: ['submitted', 'under_review'] },
        },
      });

      if (existing) {
        return {
          success: false,
          data: {
            applicationId: existing.id,
            status: existing.status,
            appliedAt: existing.appliedAt.toISOString(),
          },
          error: `You already have a ${existing.status} application for ${params.programName} (submitted ${existing.appliedAt.toISOString().substring(0, 10)}).`,
        };
      }

      const application = await db.programApplication.create({
        data: {
          userId,
          programName: params.programName,
          programId: params.programId ?? null,
          status: 'submitted',
          metadata: params.notes ? { notes: params.notes } : undefined,
        },
      });

      // Enqueue a notification action for the EdLight team
      await enqueueAction({
        userId,
        sessionId: context.sessionId,
        channel: 'web',
        tool: 'submitApplication',
        input: {
          applicationId: application.id,
          programName: params.programName,
          notes: params.notes,
        },
        requiresApproval: false,
        metadata: { applicationId: application.id, programName: params.programName },
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'submitApplication',
        details: { applicationId: application.id, programName: params.programName },
        success: true,
      }).catch(() => {});

      const programUrls: Record<string, string> = {
        ESLP: 'https://www.edlight.org/eslp',
        Nexus: 'https://www.edlight.org/nexus',
        Labs: 'https://www.edlight.org/labs',
        Academy: 'https://academy.edlight.org',
        Code: 'https://code.edlight.org',
      };

      const knownProgram = KNOWN_PROGRAMS.find((p) =>
        params.programName.toUpperCase().includes(p.toUpperCase()),
      );
      const url = knownProgram ? programUrls[knownProgram] : 'https://www.edlight.org';

      return {
        success: true,
        data: {
          applicationId: application.id,
          programName: params.programName,
          status: 'submitted',
          appliedAt: application.appliedAt.toISOString(),
          confirmation: `Your application for ${params.programName} has been recorded! The EdLight team will be in touch. You can also visit ${url} for more information.`,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to submit application: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(submitApplicationTool);
export { submitApplicationTool };
