/**
 * createLead — capture a contact/enquiry from a user who wants EdLight to
 * reach out to them. The lead is stored in the action queue (auto-executed,
 * no human approval required) and audit-logged.
 *
 * Required scopes: actions:submit
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { enqueueAction } from '@/lib/actions/queue';
import { actionRateLimiter } from '@/lib/actions/rate-limiter';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  name: z
    .string()
    .optional()
    .describe('Full name of the person expressing interest'),
  email: z
    .string()
    .email()
    .optional()
    .describe('Contact email address'),
  phone: z
    .string()
    .optional()
    .describe('Contact phone number (optional)'),
  interest: z
    .string()
    .min(3)
    .describe('What they are interested in — a program, scholarship, partnership, etc.'),
  program: z
    .string()
    .optional()
    .describe('Specific EdLight program name if known (e.g. "ESLP", "Nexus", "Academy Scholarship")'),
});

const createLead: SandraTool = {
  name: 'createLead',
  description:
    'Record a new lead or contact request. Use this when a user explicitly asks EdLight to reach out to them, provides their contact information, or expresses interest in a specific program or partnership. Do NOT use this for general questions — only when the user wants to be contacted.',
  parameters: {
    type: 'object',
    properties: {
      name:     { type: 'string', description: 'Full name of the contact' },
      email:    { type: 'string', format: 'email', description: 'Contact email address' },
      phone:    { type: 'string', description: 'Contact phone number' },
      interest: { type: 'string', description: 'What they are interested in' },
      program:  { type: 'string', description: 'Specific EdLight program name' },
    },
    required: ['interest'],
  },
  inputSchema,
  requiredScopes: ['actions:submit'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId ?? context.sessionId;

    // Rate limit: max 3 leads per user per 10 min
    if (!actionRateLimiter.consume(userId, 'createLead')) {
      return { success: false, data: null, error: 'Too many lead submissions. Please wait a few minutes before trying again.' };
    }

    const result = await enqueueAction({
      userId:           context.userId,
      sessionId:        context.sessionId,
      channel:          'web',
      tool:             'createLead',
      input:            params as Record<string, unknown>,
      requiresApproval: false,
      metadata:         { capturedAt: new Date().toISOString() },
    });

    await logAuditEvent({
      userId:    context.userId,
      sessionId: context.sessionId,
      action:    'data_access',
      resource:  'createLead',
      details:   { actionId: result.actionId, program: params.program, hasEmail: !!params.email },
      success:   true,
    });

    return {
      success: true,
      data: {
        actionId: result.actionId,
        message:  'Your contact information has been recorded. An EdLight team member will reach out to you soon.',
        program:  params.program ?? null,
      },
    };
  },
};

toolRegistry.register(createLead);
export { createLead };
