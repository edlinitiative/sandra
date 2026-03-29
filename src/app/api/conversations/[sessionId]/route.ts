import { NextResponse } from 'next/server';
import { getPrismaSessionStore } from '@/lib/memory/session-store';
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

    const store = getPrismaSessionStore();
    const messages = await store.getMessages(sessionId, { limit: 100 }).catch(() => []);
    const session =
      typeof store.getSession === 'function'
        ? await store.getSession(sessionId).catch(() => null)
        : null;

    if (messages.length === 0) {
      const err = new NotFoundError('Session', sessionId);
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    return NextResponse.json(
      successResponse(
        {
          sessionId,
          language: session?.language ?? null,
          messages: messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({
              role: m.role,
              content: m.content,
              createdAt: m.createdAt.toISOString(),
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
