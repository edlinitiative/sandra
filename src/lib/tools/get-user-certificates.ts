/**
 * Tool: getUserCertificates
 *
 * Returns the authenticated user's earned certificates across
 * EdLight platforms.
 *
 * Requires: certificates:read scope (student+ role)
 */
import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';
import { getCertificatesByUserId } from '@/lib/db/certificates';

const inputSchema = z
  .object({
    platform: z
      .enum(['academy', 'code'])
      .optional()
      .describe('Filter by platform: "academy" or "code"'),
  })
  .strict();

const getUserCertificatesTool: SandraTool = {
  name: 'getUserCertificates',
  description:
    'Retrieve the authenticated user\'s earned certificates from EdLight platforms. Can filter by platform (academy/code). Only works for signed-in users.',
  parameters: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['academy', 'code'],
        description: 'Filter by platform',
      },
    },
    additionalProperties: false,
  },
  inputSchema,
  requiredScopes: ['certificates:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    if (!context.userId) {
      return {
        success: false,
        data: null,
        error: 'User is not authenticated. Please sign in to view your certificates.',
      };
    }

    const parsed = inputSchema.parse(input);

    try {
      const certificates = await getCertificatesByUserId(db, context.userId, {
        platform: parsed.platform,
      });

      if (certificates.length === 0) {
        return {
          success: true,
          data: {
            certificates: [],
            count: 0,
            message: `No certificates earned yet${parsed.platform ? ` on ${parsed.platform}` : ''}. Complete a course to earn your first certificate!`,
          },
        };
      }

      return {
        success: true,
        data: {
          certificates: certificates.map((c) => ({
            id: c.id,
            courseName: c.courseName,
            platform: c.platform,
            issuedAt: c.issuedAt.toISOString(),
            certificateUrl: c.certificateUrl,
          })),
          count: certificates.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to load certificates: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(getUserCertificatesTool);
export default getUserCertificatesTool;
