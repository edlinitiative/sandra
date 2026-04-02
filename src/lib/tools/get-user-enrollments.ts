/**
 * Tool: getUserEnrollments
 *
 * Returns the authenticated user's course enrollments across
 * EdLight platforms (Academy, Code).
 *
 * Requires: enrollments:read scope (student+ role)
 */
import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';
import { getEnrollmentsByUserId } from '@/lib/db/enrollments';

const inputSchema = z
  .object({
    platform: z
      .enum(['academy', 'code'])
      .optional()
      .describe('Filter by platform: "academy" or "code"'),
    status: z
      .enum(['active', 'completed', 'dropped'])
      .optional()
      .describe('Filter by enrollment status'),
  })
  .strict();

const getUserEnrollmentsTool: SandraTool = {
  name: 'getUserEnrollments',
  description:
    'Retrieve the authenticated user\'s course enrollments on EdLight platforms. Can filter by platform (academy/code) and status (active/completed/dropped). Only works for signed-in users.',
  parameters: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['academy', 'code'],
        description: 'Filter by platform',
      },
      status: {
        type: 'string',
        enum: ['active', 'completed', 'dropped'],
        description: 'Filter by enrollment status',
      },
    },
    additionalProperties: false,
  },
  inputSchema,
  requiredScopes: ['enrollments:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    if (!context.userId) {
      return {
        success: false,
        data: null,
        error: 'User is not authenticated. Please sign in to view your enrollments.',
      };
    }

    const parsed = inputSchema.parse(input);

    try {
      const enrollments = await getEnrollmentsByUserId(db, context.userId, {
        platform: parsed.platform,
        status: parsed.status,
      });

      if (enrollments.length === 0) {
        const filterDesc = [
          parsed.platform ? `on ${parsed.platform}` : '',
          parsed.status ? `with status "${parsed.status}"` : '',
        ]
          .filter(Boolean)
          .join(' ');

        return {
          success: true,
          data: {
            enrollments: [],
            count: 0,
            message: `No enrollments found${filterDesc ? ` ${filterDesc}` : ''}. You can explore courses on EdLight Academy or EdLight Code.`,
          },
        };
      }

      return {
        success: true,
        data: {
          enrollments: enrollments.map((e) => ({
            id: e.id,
            courseName: e.courseName,
            courseId: e.courseId,
            platform: e.platform,
            status: e.status,
            enrolledAt: e.enrolledAt.toISOString(),
            completedAt: e.completedAt?.toISOString() ?? null,
          })),
          count: enrollments.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to load enrollments: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(getUserEnrollmentsTool);
export default getUserEnrollmentsTool;
