import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createLogger } from '@/lib/utils';

const log = createLogger('debug:webhook-test');

/**
 * Debug endpoint to test waitUntil behavior.
 * POST /api/debug/webhook-test — simulates background processing.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  log.info('Webhook test received', { body });

  waitUntil(
    (async () => {
      log.info('Background task STARTED');
      // Simulate OpenAI call delay
      await new Promise((r) => setTimeout(r, 2000));
      log.info('Background task COMPLETED after 2s');
    })(),
  );

  return NextResponse.json({ status: 'ok', received: true });
}

export async function GET() {
  return NextResponse.json({ status: 'debug endpoint active' });
}
