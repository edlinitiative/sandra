import { NextResponse } from 'next/server';
import { indexDriveFiles } from '@/lib/google/drive-indexer';
import { generateRequestId, apiErrorResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';

const EDLIGHT_TENANT_ID = 'cmnhsjh850000a1y1b69ji257';

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

    const result = await indexDriveFiles({
      tenantId: EDLIGHT_TENANT_ID,
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
