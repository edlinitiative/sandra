/**
 * Voice channel adapter.
 *
 * STT: OpenAI Whisper API  (/v1/audio/transcriptions)
 * TTS: OpenAI TTS API      (/v1/audio/speech)
 *
 * Both services reuse the existing OPENAI_API_KEY.
 * Voice is synchronous request-response (not a push webhook), so the
 * VoiceChannelAdapter is used by the /api/voice/* endpoints directly.
 */

import { env } from '@/lib/config';
import type { ChannelAdapter, InboundMessage, OutboundMessage } from './types';
import { formatForVoice } from './voice-formatter';

// ─── Whisper STT ──────────────────────────────────────────────────────────────

export interface TranscriptionResult {
  text: string;
  language?: string;
}

/**
 * Transcribe an audio buffer using OpenAI Whisper.
 *
 * @param audioBuffer  Raw audio bytes (mp3, wav, m4a, webm, ogg, etc.)
 * @param mimeType     MIME type of the audio, e.g. 'audio/mpeg'
 * @param filename     Filename with extension — Whisper uses extension for codec detection
 * @param language     Optional BCP-47 language hint (e.g. 'en', 'fr', 'ht')
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  filename: string,
  language?: string,
): Promise<TranscriptionResult> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  formData.append('file', blob, filename);
  formData.append('model', env.OPENAI_WHISPER_MODEL);
  formData.append('response_format', 'verbose_json');
  if (language) {
    formData.append('language', language);
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Whisper API error: HTTP ${response.status} — ${err}`);
  }

  const json = (await response.json()) as { text: string; language?: string };
  return { text: json.text.trim(), language: json.language };
}

// ─── OpenAI TTS ───────────────────────────────────────────────────────────────

export type TtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TtsFormat = 'mp3' | 'opus' | 'aac' | 'flac';

/**
 * Synthesize speech from text using OpenAI TTS.
 *
 * @param text    The text to speak.
 * @param voice   Voice ID — defaults to env.OPENAI_TTS_VOICE ('alloy')
 * @param format  Audio format — defaults to 'mp3'
 * @returns       Audio bytes as a Buffer
 */
export async function synthesizeSpeech(
  text: string,
  voice?: TtsVoice,
  format: TtsFormat = 'mp3',
): Promise<Buffer> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const selectedVoice = voice ?? (env.OPENAI_TTS_VOICE as TtsVoice);

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_TTS_MODEL,
      input: text,
      voice: selectedVoice,
      response_format: format,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`TTS API error: HTTP ${response.status} — ${err}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── VoiceChannelAdapter ──────────────────────────────────────────────────────

/**
 * Inbound payload shape for voice (populated by /api/voice/* endpoints
 * after STT transcription, before passing to the agent).
 */
export interface VoiceInboundPayload {
  transcription: string;
  channelUserId: string; // session identifier or user identifier
  language?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Voice channel adapter.
 *
 * Voice is synchronous (request-response), so `send()` is a no-op —
 * the /api/voice/chat endpoint returns the synthesized audio directly
 * to the caller instead of pushing it to a third-party platform.
 */
export class VoiceChannelAdapter implements ChannelAdapter {
  readonly channelType = 'voice' as const;

  /**
   * Parse a voice inbound payload (already-transcribed) into a normalized
   * InboundMessage. The transcription is performed upstream by the route
   * handler via `transcribeAudio()`.
   */
  async parseInbound(rawPayload: unknown): Promise<InboundMessage> {
    const payload = rawPayload as VoiceInboundPayload;

    if (!payload?.transcription || typeof payload.transcription !== 'string') {
      throw new Error('Voice inbound payload missing transcription');
    }
    if (!payload?.channelUserId || typeof payload.channelUserId !== 'string') {
      throw new Error('Voice inbound payload missing channelUserId');
    }

    return {
      channelType: 'voice',
      channelUserId: payload.channelUserId,
      content: payload.transcription.trim(),
      language: payload.language as InboundMessage['language'],
      timestamp: new Date(),
      metadata: payload.metadata,
    };
  }

  /**
   * Format an outbound response for voice.
   * Returns an object suitable for TTS — the caller feeds `.text` to
   * `synthesizeSpeech()`.
   */
  async formatOutbound(message: OutboundMessage): Promise<{ text: string }> {
    return { text: formatForVoice(message.content) };
  }

  /**
   * Voice is synchronous — the response is returned directly to the HTTP
   * caller. This method is a no-op.
   */
  async send(_message: OutboundMessage): Promise<void> {
    // No-op: voice responses are returned synchronously from the API route.
  }

  /**
   * Voice is available whenever the OpenAI API key is set.
   */
  isConfigured(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _adapter: VoiceChannelAdapter | null = null;

export function getVoiceAdapter(): VoiceChannelAdapter {
  if (!_adapter) {
    _adapter = new VoiceChannelAdapter();
  }
  return _adapter;
}
