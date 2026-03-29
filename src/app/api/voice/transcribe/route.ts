/**
 * POST /api/voice/transcribe
 *
 * Accepts a multipart/form-data audio file and returns its transcription.
 *
 * Request (multipart/form-data):
 *   audio    — audio file (mp3, wav, m4a, webm, ogg …)
 *   language — optional BCP-47 language hint ('en', 'fr', 'ht')
 *
 * Response 200:
 *   { transcription: string, language?: string, estimatedWords: number }
 *
 * Response 400: missing audio file
 * Response 500: Whisper API error
 */

import { NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/channels/voice';
import { generateRequestId, createLogger } from '@/lib/utils';

const log = createLogger('api:voice:transcribe');

const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'video/webm', // browsers often send voice recordings as video/webm
]);

const EXT_FOR_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
  'video/webm': 'webm',
};

export async function POST(request: Request) {
  const requestId = generateRequestId();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Request must be multipart/form-data' },
      { status: 400 },
    );
  }

  const audioFile = formData.get('audio');
  if (!audioFile || !(audioFile instanceof File) || audioFile.size === 0) {
    return NextResponse.json(
      { error: 'Missing required field: audio (File)' },
      { status: 400 },
    );
  }

  const language = (formData.get('language') as string | null) ?? undefined;

  const mimeType = audioFile.type || 'audio/mpeg';
  if (!SUPPORTED_AUDIO_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported audio type: ${mimeType}` },
      { status: 400 },
    );
  }

  const ext = EXT_FOR_MIME[mimeType] ?? 'mp3';
  const filename = audioFile.name || `audio.${ext}`;

  try {
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    log.info('Transcribing audio', {
      requestId,
      sizeBytes: buffer.length,
      mimeType,
      language,
    });

    const result = await transcribeAudio(buffer, mimeType, filename, language);
    const estimatedWords = result.text.trim().split(/\s+/).filter(Boolean).length;

    log.info('Transcription complete', { requestId, words: estimatedWords });

    return NextResponse.json({
      transcription: result.text,
      language: result.language,
      estimatedWords,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Transcription failed', { requestId, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
