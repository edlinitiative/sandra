import { NextResponse } from 'next/server';
import { indexDriveFiles } from '@/lib/google/drive-indexer';
import { generateRequestId, apiErrorResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';
import { env } from '@/lib/config';

/**
 * POST /api/index/drive — Index Google Drive files into the knowledge vector store.
 *
 * Body (optional):
 *   { folderIds?: string[], maxFiles?: number, force?: boolean }
 *
 * If no folderIds provided, indexes the entire Drive for the configured impersonation user.
 *
 * Requires: x-api-key header with ADMIN_API_KEY
 */
export async function POST(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      // empty body is fine
    }

    const tenantId = env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'DEFAULT_TENANT_ID not configured' }, { status: 500 });
    }

    const result = await indexDriveFiles({
      tenantId,
      folderIds: body.folderIds as string[] | undefined,
      maxFiles: (body.maxFiles as number) ?? 200,
      force: (body.force as boolean) ?? false,
    });

    return NextResponse.json({
      status: 'ok',
      requestId,
      result,
    });
  } catch (error) {
    const { envelope, status } = apiErrorResponse(
      error instanceof Error ? error : new Error('Unknown error'),
      requestId,
    );
    return NextResponse.json(envelope, { status });
  }
}
