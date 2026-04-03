/**
 * createGoogleForm — create a Google Form for surveys, applications, or registrations.
 *
 * Requires a connected Google Workspace tenant with domain-wide delegation
 * that includes the Google Forms API scope.
 *
 * Required scopes: forms:write
 *
 * Common use cases:
 *   - Creating program application forms (e.g. ESLP 2026 application)
 *   - Cloning/recreating a new version of an existing form
 *   - Building surveys, registration forms, feedback forms
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { createForm } from '@/lib/google/forms';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import type { FormQuestionType } from '@/lib/google/types';

const questionSchema = z.object({
  title: z.string().min(1).max(500).describe('Question text or section heading'),
  description: z.string().max(500).optional().describe('Optional helper text shown below the question'),
  type: z.enum([
    'short_answer',
    'paragraph',
    'multiple_choice',
    'checkbox',
    'dropdown',
    'date',
    'section_header',
  ] as [FormQuestionType, ...FormQuestionType[]]).describe(
    'Question type: short_answer (one-line text), paragraph (multi-line), multiple_choice (radio), checkbox (multi-select), dropdown, date, or section_header (divider with no answer)',
  ),
  required: z.boolean().optional().default(false).describe('Whether the question is required'),
  options: z
    .array(z.string().min(1).max(200))
    .max(30)
    .optional()
    .describe('Answer choices — required for multiple_choice, checkbox, and dropdown types'),
});

const inputSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('Form title, e.g. "ESLP 2026 Application Form"'),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe('Form description or instructions shown at the top of the form'),
  questions: z
    .array(questionSchema)
    .min(1)
    .max(100)
    .describe('List of questions/sections to include in the form'),
  ownerEmail: z
    .string()
    .email()
    .optional()
    .describe(
      'Email of the Google Workspace user who should own the form (defaults to the requesting user). The form will appear in their Google Drive.',
    ),
});

const createGoogleFormTool: SandraTool = {
  name: 'createGoogleForm',
  description:
    "Create a Google Form (for applications, surveys, registrations, or feedback). Use when the user asks to create a form, build an application form, or set up a survey in Google Forms. For program applications (e.g. ESLP), include standard sections: personal info, academic background, motivation/essay questions, and any program-specific questions. You can also read a prior form from Drive first to base the new form on the existing structure. Returns a link for respondents and an editor link.",
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Form title, e.g. "ESLP 2026 Application Form"',
        maxLength: 200,
      },
      description: {
        type: 'string',
        description: 'Form description or instructions',
        maxLength: 2000,
      },
      questions: {
        type: 'array',
        description: 'Questions/sections to include',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Question text or section heading' },
            description: { type: 'string', description: 'Optional helper text' },
            type: {
              type: 'string',
              enum: ['short_answer', 'paragraph', 'multiple_choice', 'checkbox', 'dropdown', 'date', 'section_header'],
              description: 'Question type',
            },
            required: { type: 'boolean', description: 'Whether required', default: false },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Choices for multiple_choice, checkbox, or dropdown',
            },
          },
          required: ['title', 'type'],
        },
      },
      ownerEmail: {
        type: 'string',
        description: 'Owner email (defaults to requesting user)',
        format: 'email',
      },
    },
    required: ['title', 'questions'],
  },
  inputSchema,
  requiredScopes: ['forms:write'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'You need to be signed in to create Google Forms.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'Your account is not linked to a Workspace with Google Forms access.' };
    }

    // Determine the impersonation email
    let ownerEmail = params.ownerEmail ?? null;
    if (!ownerEmail) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      ownerEmail = user?.email ?? null;
    }

    if (!ownerEmail) {
      return { success: false, data: null, error: 'No email address found. Say "my email is you@edlight.org" to link your account first.' };
    }

    try {
      const ctx = await resolveGoogleContext(tenantId, ownerEmail);

      const result = await createForm(ctx, {
        title: params.title,
        description: params.description,
        questions: params.questions.map((q) => ({
          title: q.title,
          description: q.description,
          type: q.type as FormQuestionType,
          required: q.required ?? false,
          options: q.options,
        })),
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'createGoogleForm',
        details: {
          formId: result.formId,
          title: params.title,
          questionCount: result.questionCount,
          ownerEmail,
          tenantId,
        },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          message: `Google Form created: "${result.title}" with ${result.questionCount} question${result.questionCount !== 1 ? 's' : ''}.\n\n📋 **Respond**: ${result.responderUri}\n✏️ **Edit**: ${result.editUrl}\n\nShare the respond link with applicants. Responses will be collected in Google Forms and can also be linked to a Google Sheet.`,
          formId: result.formId,
          title: result.title,
          responderUri: result.responderUri,
          editUrl: result.editUrl,
          questionCount: result.questionCount,
          ownerEmail,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('403')) {
        return {
          success: false,
          data: null,
          error: 'Google Forms API access is not yet enabled for your Workspace. A Super Admin needs to add the Forms API scope (https://www.googleapis.com/auth/forms.body) under Domain-wide Delegation in Google Admin Console.',
        };
      }

      return { success: false, data: null, error: `Couldn't create the form: ${message}` };
    }
  },
};

toolRegistry.register(createGoogleFormTool);
