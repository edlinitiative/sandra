import { NextResponse } from 'next/server';
import { getSessionStore } from '@/lib/memory/session-store';
import { errorResponse } from '@/lib/utils';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;

    if (!sessionId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'sessionId is required' } },
        { status: 400 },
      );
    }

    const store = getSessionStore();
    const history = await store.getHistory(sessionId);

    return NextResponse.json({
      data: {
        sessionId,
        messages: history.map((entry) => ({
          role: entry.role,
          content: entry.content,
          timestamp: entry.timestamp.toISOString(),
          metadata: entry.metadata,
        })),
        messageCount: history.length,
      },
    });
  } catch (error) {
    const err = errorResponse(error);
    return NextResponse.json({ error: err.error }, { status: err.status });
  }
}
