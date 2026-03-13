import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getVectorStore } from '@/lib/knowledge';

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms),
  );
  return Promise.race([promise, timeout]);
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const checks: Record<string, string> = {};

  // Database check
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, 5000);
    checks.database = 'ok';
  } catch (err) {
    checks.database = `error: ${err instanceof Error ? err.message : 'unknown'}`;
  }

  // Vector store check
  try {
    const vectorStore = getVectorStore();
    await withTimeout(vectorStore.count(), 5000);
    checks.vectorStore = 'ok';
  } catch (err) {
    checks.vectorStore = `error: ${err instanceof Error ? err.message : 'unknown'}`;
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const status = allOk ? 'ok' : 'degraded';

  return NextResponse.json(
    { status, timestamp, checks },
    { status: allOk ? 200 : 503 },
  );
}
