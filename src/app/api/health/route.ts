import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getVectorStore } from '@/lib/knowledge';
import { APP_NAME, APP_VERSION } from '@/lib/config';
import { toolRegistry } from '@/lib/tools';

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms),
  );
  return Promise.race([promise, timeout]);
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const checks: Record<string, string> = {};
  let totalRepos: number | null = null;
  let activeRepos: number | null = null;
  let indexedRepos: number | null = null;
  let indexingRepos: number | null = null;
  let errorRepos: number | null = null;
  let indexedSources: number | null = null;
  let indexedDocuments: number | null = null;
  let vectorStoreChunks: number | null = null;

  // Database check
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, 5000);
    checks.database = 'ok';

    [
      totalRepos,
      activeRepos,
      indexedRepos,
      indexingRepos,
      errorRepos,
      indexedSources,
      indexedDocuments,
    ] = await withTimeout(
      Promise.all([
        db.repoRegistry.count(),
        db.repoRegistry.count({ where: { isActive: true } }),
        db.repoRegistry.count({ where: { syncStatus: 'indexed' } }),
        db.repoRegistry.count({ where: { syncStatus: 'indexing' } }),
        db.repoRegistry.count({ where: { syncStatus: 'error' } }),
        db.indexedSource.count(),
        db.indexedDocument.count(),
      ]),
      5000,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    const isConnectionError = /Can't reach database server|Connection refused|ECONNREFUSED/i.test(msg);
    checks.database = isConnectionError ? 'unavailable' : `error: ${msg}`;
  }

  // Vector store check
  try {
    const vectorStore = getVectorStore();
    vectorStoreChunks = await withTimeout(vectorStore.count(), 5000);
    checks.vectorStore = 'ok';
  } catch (err) {
    checks.vectorStore = `error: ${err instanceof Error ? err.message : 'unknown'}`;
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const status = allOk ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      name: APP_NAME,
      version: APP_VERSION,
      status,
      timestamp,
      checks,
      summary: {
        repos: {
          total: totalRepos,
          active: activeRepos,
          indexed: indexedRepos,
          indexing: indexingRepos,
          error: errorRepos,
        },
        tools: {
          count: toolRegistry.getToolNames().length,
          registered: toolRegistry.getToolNames(),
        },
        knowledge: {
          indexedSources,
          indexedDocuments,
          vectorStoreChunks,
        },
      },
    },
    { status: allOk ? 200 : 503 },
  );
}
