/**
 * requestCertificate — request or view certificates for completed courses.
 *
 * For completed enrollments, this creates or surfaces the certificate record
 * and provides the certificate URL.
 *
 * Required scopes: profile:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  courseName: z
    .string()
    .min(2)
    .max(200)
    .optional()
    .describe('The name of the course to request a certificate for. Omit to list all certificates.'),
  platform: z
    .enum(['academy', 'code'])
    .optional()
    .describe("Platform: 'academy' or 'code'"),
});

const requestCertificateTool: SandraTool = {
  name: 'requestCertificate',
  description:
    "View or request certificates for completed EdLight courses. Use when the user asks about their certificates, wants to see proof of completion, asks how to get a certificate, or says they finished a course. Lists existing certificates and checks if any completed enrollments are missing certificates.",
  parameters: {
    type: 'object',
    properties: {
      courseName: { type: 'string', description: 'Course name to request a certificate for (optional)' },
      platform: { type: 'string', enum: ['academy', 'code'], description: "Platform: 'academy' or 'code'" },
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
        error: 'You need to be signed in to view or request certificates.',
      };
    }

    try {
      // Fetch existing certificates
      const certWhere: Record<string, unknown> = { userId };
      if (params.platform) certWhere.platform = params.platform;
      if (params.courseName) certWhere.courseName = { contains: params.courseName, mode: 'insensitive' };

      const certificates = await db.certificate.findMany({
        where: certWhere,
        orderBy: { issuedAt: 'desc' },
      });

      // Find completed enrollments without certificates
      const completedEnrollments = await db.enrollment.findMany({
        where: {
          userId,
          status: 'completed',
          ...(params.platform ? { platform: params.platform } : {}),
        },
      });

      const certNames = new Set(certificates.map((c) => c.courseName.toLowerCase()));
      const missingCerts = completedEnrollments.filter(
        (e) => !certNames.has(e.courseName.toLowerCase()),
      );

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'requestCertificate',
        details: { certCount: certificates.length, missingCount: missingCerts.length },
        success: true,
      }).catch(() => {});

      if (certificates.length === 0 && missingCerts.length === 0) {
        return {
          success: true,
          data: {
            message: "You don't have any certificates yet. Complete a course on EdLight Code (code.edlight.org) or EdLight Academy (academy.edlight.org) to earn one!",
            certificates: [],
          },
        };
      }

      return {
        success: true,
        data: {
          certificates: certificates.map((c) => ({
            courseName: c.courseName,
            platform: c.platform,
            issuedAt: c.issuedAt.toISOString().substring(0, 10),
            certificateUrl: c.certificateUrl ?? 'Contact support to generate your certificate URL.',
          })),
          pendingCertificates: missingCerts.map((e) => ({
            courseName: e.courseName,
            platform: e.platform,
            completedAt: e.completedAt?.toISOString().substring(0, 10),
            note: `Your certificate for "${e.courseName}" is being processed. Visit ${e.platform === 'code' ? 'code.edlight.org' : 'academy.edlight.org'} to download it.`,
          })),
          summary: {
            issued: certificates.length,
            pending: missingCerts.length,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve certificates: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(requestCertificateTool);
export { requestCertificateTool };
