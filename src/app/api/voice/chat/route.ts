/**
 * POST /api/voice/chat
 *
 * Full voice round-trip:
 *   1. Accept audio file + optional sessionId / language
 *   2. STT via Whisper → transcription
 *   3. Resolve identity + session → run Sandra agent
 *   4. Format response for voice → synthesize TTS audio
 *   5. Return JSON with transcription, text response, and base64 audio
 *
 * Request (multipart/form-data):
 *   audio      — audio file (mp3, wav, m4a, webm, ogg …)
 *   sessionId  — optional existing session ID
 *   language   — optional BCP-47 language hint ('en', 'fr', 'ht')
 *   voice      — optional TTS voice ('alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer')
 *
 * Response 200:
 *   {
 *     transcription : string,   // what the user said
 *     response      : string,   // Sandra's voice-formatted text response
 *     audio         : string,   // base64-encoded mp3
 *     language      : string,   // detected/resolved language
 *     sessionId     : string,   // session to pass back on next turn
 *     estimatedSpeakSeconds: number
 *   }
 */

import { NextResponse } from 'next/server';
import { transcribeAudio, synthesizeSpeech, type TtsVoice } from '@/lib/channels/voice';
import { formatForVoice, estimateSpeakDuration } from '@/lib/channels/voice-formatter';
import { resolveChannelIdentity } from '@/lib/channels/channel-identity';
import { ensureSessionContinuity, getOrCreateSessionForChannel } from '@/lib/memory/session-continuity';
import { runSandraAgent } from '@/lib/agents';
import { resolveLanguage } from '@/lib/i18n';
import { getScopesForRole } from '@/lib/auth';
import { setCorrelationId, clearCorrelationId } from '@/lib/tools/resilience';
import { generateRequestId, createLogger } from '@/lib/utils';

const log = createLogger('api:voice:chat');

const VALID_VOICES: TtsVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

export async function POST(request: Request) {
  const requestId = generateRequestId();
  setCorrelationId(requestId);

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Request must be multipart/form-data' },
        { status: 400 },
      );
    }

    // ── Extract fields ─────────────────────────────────────────────────────────
    const audioFile = formData.get('audio');
    if (!audioFile || !(audioFile instanceof File) || audioFile.size === 0) {
      return NextResponse.json(
        { error: 'Missing required field: audio (File)' },
        { status: 400 },
      );
    }

    const sessionIdHint = (formData.get('sessionId') as string | null) ?? undefined;
    const languageHint = (formData.get('language') as string | null) ?? undefined;
    const voiceParam = (formData.get('voice') as string | null) ?? undefined;
    const voice = (VALID_VOICES.includes(voiceParam as TtsVoice) ? voiceParam : undefined) as
      | TtsVoice
      | undefined;

    const mimeType = audioFile.type || 'audio/mpeg';
    const filename = audioFile.name || 'audio.mp3';

    // ── STT ────────────────────────────────────────────────────────────────────
    log.info('Voice chat — transcribing', { requestId, mimeType });
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const transcriptionResult = await transcribeAudio(
      audioBuffer,
      mimeType,
      filename,
      languageHint,
    );

    const transcription = transcriptionResult.text;
    if (!transcription) {
      return NextResponse.json({ error: 'Could not transcribe audio' }, { status: 422 });
    }

    log.info('Transcription complete', { requestId, chars: transcription.length });

    // ── Identity + session ─────────────────────────────────────────────────────
    // Use sessionIdHint as channelUserId for voice — enables session continuity
    // across multiple voice turns from the same client.
    const channelUserId = sessionIdHint ?? `voice-${requestId}`;

    const identity = await resolveChannelIdentity({
      channel: 'voice',
      externalId: channelUserId,
      metadata: { requestId },
    });

    const userId = identity.userId;

    const session = await getOrCreateSessionForChannel({
      channel: 'voice',
      channelUserId,
      userId,
    });

    const sessionId = session.sessionId;
    const language = resolveLanguage({
      explicit: languageHint as Parameters<typeof resolveLanguage>[0]['explicit'],
      sessionLanguage: session.language,
    });

    await ensureSessionContinuity({ sessionId, channel: 'voice', language, userId });

    // ── Agent ──────────────────────────────────────────────────────────────────
    log.info('Running Sandra agent for voice', { requestId, sessionId });
    const scopes = getScopesForRole('guest');
    const result = await runSandraAgent({
      message: transcription,
      sessionId,
      userId,
      language,
      channel: 'voice',
      scopes,
      metadata: { requestId, source: 'voice' },
    });

    // ── TTS ────────────────────────────────────────────────────────────────────
    const spokenText = formatForVoice(result.response);
    log.info('Synthesizing response', { requestId, chars: spokenText.length });
    const audioResponseBuffer = await synthesizeSpeech(spokenText, voice, 'mp3');
    const audioBase64 = audioResponseBuffer.toString('base64');
    const estimatedSpeakSeconds = estimateSpeakDuration(spokenText);

    log.info('Voice chat complete', {
      requestId,
      sessionId,
      audioBytes: audioResponseBuffer.length,
      toolsUsed: result.toolsUsed,
    });

    return NextResponse.json({
      transcription,
      response: spokenText,
      audio: audioBase64,
      language: result.language,
      sessionId,
      estimatedSpeakSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Voice chat error', { requestId, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    clearCorrelationId();
  }
}
