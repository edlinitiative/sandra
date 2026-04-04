/**
 * POST /api/chat/feedback
 *
 * Record a user rating (👍 / 👎) for a Sandra response.
 *
 * Body: { sessionId, messageRef, rating: 'up'|'down', comment? }
 * Auth: optional — anonymous feedback is accepted.
 *
 * Returns: { success: true } or error envelope.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { submitFeedback, submitFeedbackSchema } from '@/lib/feedback';
import { generateRequestId, successResponse, apiErrorResponse } from '@/lib/utils';
import { ValidationError } from '@/lib/utils/errors';

export async function POST(request: Request) {
  const requestId = generateRequestId();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON body');
    }

    const params = submitFeedbackSchema.parse(body);

    await submitFeedback(params);

    return NextResponse.json(
      successResponse({ accepted: true }, { requestId }),
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      const validationError = new ValidationError(
        err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
      );
      const { envelope, status } = apiErrorResponse(validationError, requestId);
      return NextResponse.json(envelope, { status });
    }

    const { envelope, status } = apiErrorResponse(err, requestId);
    return NextResponse.json(envelope, { status });
  }
}
