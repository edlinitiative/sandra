import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    const limit = Math.min(Math.max(parseInt(limitParam ?? '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetParam ?? '0', 10) || 0, 0);

    const [sessions, totalCount] = await Promise.all([
      db.session.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { messages: true },
          },
        },
      }),
      db.session.count(),
    ]);

    const sessionList = sessions.map((s) => ({
      id: s.id,
      channel: s.channel,
      language: s.language,
      title: s.title,
      isActive: s.isActive,
      messageCount: s._count.messages,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    return NextResponse.json(
      successResponse(
        {
          sessions: sessionList,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount,
          },
        },
        { requestId },
      ),
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    const isDbUnavailable = /Can't reach database server|Connection refused|ECONNREFUSED/i.test(msg);
    if (isDbUnavailable) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is unavailable' },
          meta: { requestId },
        },
        { status: 503 },
      );
    }

    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
