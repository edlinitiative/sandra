import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';

/**
 * Diagnostic: temporarily point your IG webhook here to test if Meta calls it.
 * 
 * GET  → webhook verification (returns hub.challenge) + view stored payloads
 * POST → stores payload in memory and returns 200
 */

// In-memory store (resets on cold start — that's fine for debugging)
const payloads: { time: string; body: string }[] = [];

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json({ count: payloads.length, payloads });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body = '';
  try {
    body = await request.text();
  } catch { /* ignore */ }

  payloads.unshift({ time: new Date().toISOString(), body: body.slice(0, 2000) });
  if (payloads.length > 10) payloads.pop();

  return NextResponse.json({ status: 'ok', logged: true });
}
