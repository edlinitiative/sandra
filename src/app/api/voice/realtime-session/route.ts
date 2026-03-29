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

const REALTIME_MODEL = 'gpt-4o-realtime-preview';

export async function POST(_req: Request) {
  if (!env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured' },
      { status: 500 },
    );
  }

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: env.OPENAI_TTS_VOICE ?? 'alloy',
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
