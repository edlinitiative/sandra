/**
 * Tool: getApplicationStatus
 *
 * Returns the authenticated user's program applications and their
 * current status (submitted, under review, accepted, etc.).
 *
 * Requires: applications:read scope (student+ role)
 */
import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';
import { getApplicationsByUserId } from '@/lib/db/applications';

const inputSchema = z
  .object({
    programName: z
      .string()
      .optional()
      .describe('Filter by program name (e.g., "ESLP", "Nexus")'),
    status: z
      .enum(['submitted', 'under_review', 'accepted', 'rejected', 'waitlisted'])
      .optional()
      .describe('Filter by application status'),
  })
  .strict();

const getApplicationStatusTool: SandraTool = {
  name: 'getApplicationStatus',
  description:
    'Check the status of the authenticated user\'s program applications (ESLP, Nexus, scholarships, etc.). Can filter by program name or status. Only works for signed-in users.',
  parameters: {
    type: 'object',
    properties: {
      programName: {
        type: 'string',
        description: 'Filter by program name (e.g., "ESLP", "Nexus")',
      },
      status: {
        type: 'string',
        enum: ['submitted', 'under_review', 'accepted', 'rejected', 'waitlisted'],
        description: 'Filter by application status',
      },
    },
    additionalProperties: false,
  },
  inputSchema,
  requiredScopes: ['applications:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    if (!context.userId) {
      return {
        success: false,
        data: null,
        error: 'User is not authenticated. Please sign in to check your application status.',
      };
    }

    const parsed = inputSchema.parse(input);

    try {
      const applications = await getApplicationsByUserId(db, context.userId, {
        programName: parsed.programName,
        status: parsed.status,
      });

      if (applications.length === 0) {
        return {
          success: true,
          data: {
            applications: [],
            count: 0,
            message: `No program applications found${parsed.programName ? ` for ${parsed.programName}` : ''}. Visit edlight.org to learn about available programs and apply.`,
          },
        };
      }

      return {
        success: true,
        data: {
          applications: applications.map((a) => ({
            id: a.id,
            programName: a.programName,
            programId: a.programId,
            status: a.status,
            appliedAt: a.appliedAt.toISOString(),
            reviewedAt: a.reviewedAt?.toISOString() ?? null,
          })),
          count: applications.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to load applications: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(getApplicationStatusTool);
export default getApplicationStatusTool;
