/**
 * Google Forms API v1 — create forms and read responses.
 *
 * Uses domain-wide delegation to create forms on behalf of a Workspace user.
 * Two-step creation: (1) create the form shell, (2) batchUpdate to add items/questions.
 *
 * Required DWD scopes:
 *   - Write: https://www.googleapis.com/auth/forms.body
 *   - Read responses: https://www.googleapis.com/auth/forms.responses.readonly
 */

import { createLogger } from '@/lib/utils';
import { getContextToken, GOOGLE_SCOPES } from './auth';
import type { GoogleWorkspaceContext } from './types';
import type {
  FormInput,
  FormQuestionItem,
  FormResult,
  FormResponse,
  FormResponsesResult,
} from './types';

const log = createLogger('google:forms');

const FORMS_API = 'https://forms.googleapis.com/v1/forms';
const FORMS_SCOPES_WRITE = [GOOGLE_SCOPES.FORMS_BODY];
const FORMS_SCOPES_READ = [GOOGLE_SCOPES.FORMS_RESPONSES_READONLY];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function formsRequest<T>(
  ctx: GoogleWorkspaceContext,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  readOnly = false,
): Promise<T> {
  const scopes = readOnly ? FORMS_SCOPES_READ : FORMS_SCOPES_WRITE;
  const token = await getContextToken(ctx, scopes);

  const res = await fetch(`${FORMS_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Forms API ${method} ${path} failed: ${res.status} — ${errBody}`);
  }

  return res.json() as Promise<T>;
}

// ─── Question builders ────────────────────────────────────────────────────────

/**
 * Build a Google Forms API `Item` object from a simplified question definition.
 */
function buildFormItem(q: FormQuestionItem, index: number): Record<string, unknown> {
  const base = {
    title: q.title,
    description: q.description,
    itemId: undefined as string | undefined,
  };

  switch (q.type) {
    case 'short_answer':
      return {
        ...base,
        questionItem: {
          question: {
            required: q.required ?? false,
            textQuestion: { paragraph: false },
          },
        },
      };

    case 'paragraph':
      return {
        ...base,
        questionItem: {
          question: {
            required: q.required ?? false,
            textQuestion: { paragraph: true },
          },
        },
      };

    case 'multiple_choice':
      return {
        ...base,
        questionItem: {
          question: {
            required: q.required ?? false,
            choiceQuestion: {
              type: 'RADIO',
              options: (q.options ?? []).map((opt) => ({ value: opt })),
            },
          },
        },
      };

    case 'checkbox':
      return {
        ...base,
        questionItem: {
          question: {
            required: q.required ?? false,
            choiceQuestion: {
              type: 'CHECKBOX',
              options: (q.options ?? []).map((opt) => ({ value: opt })),
            },
          },
        },
      };

    case 'dropdown':
      return {
        ...base,
        questionItem: {
          question: {
            required: q.required ?? false,
            choiceQuestion: {
              type: 'DROP_DOWN',
              options: (q.options ?? []).map((opt) => ({ value: opt })),
            },
          },
        },
      };

    case 'date':
      return {
        ...base,
        questionItem: {
          question: {
            required: q.required ?? false,
            dateQuestion: { includeTime: false, includeYear: true },
          },
        },
      };

    case 'section_header':
      return {
        title: q.title,
        description: q.description,
        pageBreakItem: {},
      };

    default:
      // Fallback to short answer
      return {
        ...base,
        questionItem: {
          question: {
            required: q.required ?? false,
            textQuestion: { paragraph: false },
          },
        },
      };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a Google Form with questions.
 *
 * Step 1: Create the form shell (title + document title).
 * Step 2: batchUpdate to add all questions and set the description.
 */
export async function createForm(
  ctx: GoogleWorkspaceContext,
  input: FormInput,
): Promise<FormResult> {
  log.info('Creating Google Form', { title: input.title, tenantId: ctx.tenantId });

  // Step 1 — create the form shell
  const created = await formsRequest<{ formId: string; responderUri: string }>(
    ctx,
    'POST',
    '',
    {
      info: {
        title: input.title,
        documentTitle: input.title,
      },
    },
  );

  const formId = created.formId;
  log.info('Form shell created', { formId });

  // Step 2 — batchUpdate to add description + items
  const requests: unknown[] = [];

  // Set description
  if (input.description) {
    requests.push({
      updateFormInfo: {
        info: { description: input.description },
        updateMask: 'description',
      },
    });
  }

  // Add question items
  input.questions.forEach((q, idx) => {
    requests.push({
      createItem: {
        item: buildFormItem(q, idx),
        location: { index: idx },
      },
    });
  });

  if (requests.length > 0) {
    await formsRequest(ctx, 'POST', `/${formId}:batchUpdate`, { requests });
  }

  // Fetch final form to get the edit link
  const form = await formsRequest<{
    formId: string;
    responderUri: string;
    info: { title: string; description?: string };
    items?: unknown[];
  }>(ctx, 'GET', `/${formId}`, undefined, false);

  const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;

  log.info('Google Form created successfully', {
    formId,
    responderUri: form.responderUri,
    questionCount: input.questions.length,
  });

  return {
    formId,
    title: form.info.title,
    description: form.info.description,
    responderUri: form.responderUri,
    editUrl,
    questionCount: input.questions.filter((q) => q.type !== 'section_header').length,
  };
}

/**
 * Get metadata and question structure for an existing form.
 */
export async function getForm(
  ctx: GoogleWorkspaceContext,
  formId: string,
): Promise<FormResult> {
  log.info('Getting Google Form', { formId, tenantId: ctx.tenantId });

  const form = await formsRequest<{
    formId: string;
    responderUri: string;
    info: { title: string; description?: string };
    items?: Array<{ itemId: string; title?: string }>;
  }>(ctx, 'GET', `/${formId}`, undefined, false);

  return {
    formId: form.formId,
    title: form.info.title,
    description: form.info.description,
    responderUri: form.responderUri,
    editUrl: `https://docs.google.com/forms/d/${form.formId}/edit`,
    questionCount: (form.items ?? []).length,
  };
}

/**
 * Get all responses for a Google Form.
 * Returns parsed responses with question titles mapped to answers.
 */
export async function getFormResponses(
  ctx: GoogleWorkspaceContext,
  formId: string,
  maxResponses = 100,
): Promise<FormResponsesResult> {
  log.info('Getting form responses', { formId, tenantId: ctx.tenantId });

  // First get the form to build a questionId → title map
  const form = await formsRequest<{
    formId: string;
    info: { title: string };
    items?: Array<{
      itemId: string;
      title?: string;
      questionItem?: {
        question: { questionId: string };
      };
    }>;
  }>(ctx, 'GET', `/${formId}`, undefined, true);

  // Build questionId → title lookup
  const questionTitles: Record<string, string> = {};
  for (const item of form.items ?? []) {
    const questionId = item.questionItem?.question?.questionId;
    if (questionId && item.title) {
      questionTitles[questionId] = item.title;
    }
  }

  // Get responses
  const responsesData = await formsRequest<{
    responses?: Array<{
      responseId: string;
      createTime: string;
      respondentEmail?: string;
      answers?: Record<string, {
        questionId: string;
        textAnswers?: { answers: Array<{ value: string }> };
        fileUploadAnswers?: { answers: Array<{ fileId: string; fileName: string }> };
      }>;
    }>;
    nextPageToken?: string;
  }>(ctx, 'GET', `/${formId}/responses?pageSize=${maxResponses}`, undefined, true);

  const responses: FormResponse[] = (responsesData.responses ?? []).map((r) => {
    const answers: Record<string, string | string[]> = {};

    for (const [, answer] of Object.entries(r.answers ?? {})) {
      const title = questionTitles[answer.questionId] ?? answer.questionId;
      if (answer.textAnswers?.answers?.length) {
        const values = answer.textAnswers.answers.map((a) => a.value);
        answers[title] = values.length === 1 ? values[0]! : values;
      }
    }

    return {
      responseId: r.responseId,
      submittedAt: r.createTime,
      respondentEmail: r.respondentEmail,
      answers,
    };
  });

  return {
    formId,
    formTitle: form.info.title,
    totalResponses: responses.length,
    responses,
  };
}
