/**
 * POST /api/voice/speak
 *
 * Accepts JSON { text, voice?, format? } and returns synthesized audio.
 *
 * Request (application/json):
 *   text    — text to synthesize (max 4096 chars)
 *   voice   — optional: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
 *   format  — optional: 'mp3' | 'opus' | 'aac' | 'flac' (default: 'mp3')
 *
 * Response 200: audio binary with Content-Type: audio/mpeg (or chosen format)
 * Response 400: missing / invalid body
 * Response 500: TTS API error
 */

import { synthesizeSpeech, type TtsVoice, type TtsFormat } from '@/lib/channels/voice';
import { formatForVoice } from '@/lib/channels/voice-formatter';
import { generateRequestId, createLogger } from '@/lib/utils';

const log = createLogger('api:voice:speak');

const MIME_FOR_FORMAT: Record<TtsFormat, string> = {
  mp3: 'audio/mpeg',
  opus: 'audio/ogg; codecs=opus',
  aac: 'audio/aac',
  flac: 'audio/flac',
};

const VALID_VOICES: TtsVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
const VALID_FORMATS: TtsFormat[] = ['mp3', 'opus', 'aac', 'flac'];

export async function POST(request: Request) {
  const requestId = generateRequestId();

  let body: { text?: unknown; voice?: unknown; format?: unknown };
  try {
    body = (await request.json()) as { text?: unknown; voice?: unknown; format?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Missing required field: text' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.text.length > 4096) {
    return new Response(JSON.stringify({ error: 'text exceeds maximum length of 4096 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const voice = body.voice as TtsVoice | undefined;
  if (voice !== undefined && !VALID_VOICES.includes(voice)) {
    return new Response(JSON.stringify({ error: `Invalid voice: ${String(body.voice)}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const format = (body.format as TtsFormat | undefined) ?? 'mp3';
  if (!VALID_FORMATS.includes(format)) {
    return new Response(JSON.stringify({ error: `Invalid format: ${String(body.format)}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Format the text for voice before sending to TTS
  const spokenText = formatForVoice(body.text);

  try {
    log.info('Synthesizing speech', {
      requestId,
      chars: spokenText.length,
      voice: voice ?? 'default',
      format,
    });

    const audioBuffer = await synthesizeSpeech(spokenText, voice, format);
    const contentType = MIME_FOR_FORMAT[format];

    log.info('TTS complete', { requestId, bytes: audioBuffer.length });

    return new Response(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(audioBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('TTS failed', { requestId, error: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
