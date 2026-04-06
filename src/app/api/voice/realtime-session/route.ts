/**
 * POST /api/voice/realtime-session
 *
 * Mints a short-lived ephemeral key for the OpenAI Realtime API.
 * The client uses this key to complete a WebRTC SDP handshake directly
 * with OpenAI — keeping the long-lived OPENAI_API_KEY server-side only.
 *
 * Response shape mirrors OpenAI's:
 *   { id, object, model, voice, client_secret: { value, expires_at } }
 */

import { NextResponse } from 'next/server';
import { env } from '@/lib/config';
import { authenticateRequest } from '@/lib/auth/middleware';
import { getSandraSystemPrompt } from '@/lib/agents/prompts';

export async function POST(req: Request) {
  // Auth is optional for voice routes during migration
  const auth = await authenticateRequest(req);
  const userId = auth.authenticated ? auth.user.id : 'anonymous-voice';

  // ── Provider gate: only OpenAI supports realtime sessions today ──────────
  const realtimeProvider = env.REALTIME_PROVIDER ?? 'openai';
  if (realtimeProvider !== 'openai') {
    return NextResponse.json(
      { error: `Realtime not available for provider ${realtimeProvider}` },
      { status: 501 },
    );
  }

  if (!env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured' },
      { status: 500 },
    );
  }

  // Allow caller to pass a language hint (default en)
  let language: 'en' | 'fr' | 'ht' = 'en';
  try {
    const body = await req.json() as { language?: string };
    if (body.language === 'fr' || body.language === 'ht') language = body.language;
  } catch { /* no body is fine */ }

  // Use Sandra's full system prompt so voice behaves identically to text chat
  const instructions = getSandraSystemPrompt({ language });

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.REALTIME_MODEL ?? 'gpt-4o-realtime-preview',
        voice: env.OPENAI_TTS_VOICE ?? 'alloy',
        instructions,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `OpenAI error ${res.status}: ${body}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
