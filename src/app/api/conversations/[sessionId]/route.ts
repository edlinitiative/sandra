import { NextResponse } from 'next/server';
import { getSessionStore } from '@/lib/memory/session-store';
import { apiErrorResponse, generateRequestId, successResponse, sessionIdSchema, ValidationError, NotFoundError } from '@/lib/utils';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const requestId = generateRequestId();

  try {
    const { sessionId } = await context.params;

    // Validate sessionId as UUID
    const parsed = sessionIdSchema.safeParse(sessionId);
    if (!parsed.success) {
      const err = new ValidationError('Invalid session ID format');
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    const store = getSessionStore();
    const history = await store.getHistory(sessionId);

    if (history.length === 0) {
      // If no history, treat as not found
      const err = new NotFoundError('Session', sessionId);
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    return NextResponse.json(
      successResponse(
        {
          sessionId,
          messages: history.map((entry) => ({
            role: entry.role,
            content: entry.content,
            createdAt: entry.timestamp.toISOString(),
          })),
        },
        { requestId },
      ),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
