/**
 * trackLearningProgress — show the user's enrollment status and progress
 * across EdLight Academy and EdLight Code.
 *
 * Required scopes: profile:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';

const inputSchema = z.object({
  platform: z
    .enum(['academy', 'code', 'all'])
    .optional()
    .default('all')
    .describe("Filter by platform: 'academy', 'code', or 'all'"),
  status: z
    .enum(['active', 'completed', 'dropped', 'all'])
    .optional()
    .default('all')
    .describe("Filter by enrollment status"),
});

const trackLearningProgressTool: SandraTool = {
  name: 'trackLearningProgress',
  description:
    "Show the user's learning progress — their current course enrollments, completion status, and earned certificates on EdLight Academy and EdLight Code. Use when the user asks about their courses, progress, what they've completed, or their certificates.",
  parameters: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['academy', 'code', 'all'],
        description: "Platform to check: 'academy', 'code', or 'all'",
        default: 'all',
      },
      status: {
        type: 'string',
        enum: ['active', 'completed', 'dropped', 'all'],
        description: "Filter by status",
        default: 'all',
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['profile:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return {
        success: false,
        data: null,
        error: 'You need to be signed in to view your learning progress.',
      };
    }

    try {
      const enrollmentWhere: Record<string, unknown> = { userId };
      if (params.platform !== 'all') enrollmentWhere.platform = params.platform;
      if (params.status !== 'all') enrollmentWhere.status = params.status;

      const [enrollments, certificates] = await Promise.all([
        db.enrollment.findMany({
          where: enrollmentWhere,
          orderBy: { enrolledAt: 'desc' },
        }),
        db.certificate.findMany({
          where: {
            userId,
            ...(params.platform !== 'all' ? { platform: params.platform } : {}),
          },
          orderBy: { issuedAt: 'desc' },
        }),
      ]);

      const activeCount = enrollments.filter((e) => e.status === 'active').length;
      const completedCount = enrollments.filter((e) => e.status === 'completed').length;
      const certCount = certificates.length;

      if (enrollments.length === 0 && certificates.length === 0) {
        return {
          success: true,
          data: {
            message: "You don't have any enrollments yet. Start learning for free at code.edlight.org or academy.edlight.org!",
            enrollments: [],
            certificates: [],
            summary: { active: 0, completed: 0, certificates: 0 },
          },
        };
      }

      return {
        success: true,
        data: {
          summary: {
            active: activeCount,
            completed: completedCount,
            certificates: certCount,
          },
          enrollments: enrollments.map((e) => ({
            courseName: e.courseName,
            platform: e.platform,
            status: e.status,
            enrolledAt: e.enrolledAt.toISOString().substring(0, 10),
            completedAt: e.completedAt?.toISOString().substring(0, 10),
          })),
          certificates: certificates.map((c) => ({
            courseName: c.courseName,
            platform: c.platform,
            issuedAt: c.issuedAt.toISOString().substring(0, 10),
            certificateUrl: c.certificateUrl,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to load learning progress: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(trackLearningProgressTool);
export { trackLearningProgressTool };
