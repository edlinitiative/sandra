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
 * Maps BCP-47 base codes that Whisper doesn't support to the closest language
 * it does support, to avoid HTTP 400 errors and CJK hallucinations.
 *
 * Key mapping: Haitian Creole ('ht') → French ('fr')
 *   HC is a French-based creole; using 'fr' keeps Whisper in the Latin script
 *   and produces far more accurate transcriptions than auto-detect, which can
 *   confuse HC phonemes for Asian languages and output CJK characters.
 */
const WHISPER_LANGUAGE_REMAP: Record<string, string> = {
  ht: 'fr', // Haitian Creole → French (closest supported language)
  // Add further remaps here as needed
};

/**
 * ISO 639-1 codes natively supported by OpenAI Whisper.
 */
const WHISPER_SUPPORTED_LANGUAGES = new Set([
  'af', 'ar', 'hy', 'az', 'be', 'bs', 'bg', 'ca', 'zh', 'hr', 'cs', 'da',
  'nl', 'en', 'et', 'fi', 'fr', 'gl', 'de', 'el', 'he', 'hi', 'hu', 'is',
  'id', 'it', 'ja', 'kn', 'kk', 'ko', 'lv', 'lt', 'mk', 'ms', 'mr', 'mi',
  'ne', 'no', 'fa', 'pl', 'pt', 'ro', 'ru', 'sr', 'sk', 'sl', 'es', 'sw',
  'sv', 'tl', 'ta', 'th', 'tr', 'uk', 'ur', 'vi', 'cy',
]);

/**
 * Resolve the best language hint to send to Whisper for a given BCP-47 code.
 * Returns undefined if language is unset, remaps unsupported codes (e.g. 'ht' → 'fr'),
 * and drops anything not in the supported set.
 */
function resolveWhisperLanguage(language: string | undefined): string | undefined {
  if (!language) return undefined;
  const base = language.toLowerCase().split('-')[0];
  if (!base) return undefined;
  const remapped = WHISPER_LANGUAGE_REMAP[base] ?? base;
  return WHISPER_SUPPORTED_LANGUAGES.has(remapped) ? remapped : undefined;
}

/**
 * Transcribe an audio buffer using OpenAI Whisper.
 *
 * @param audioBuffer  Raw audio bytes (mp3, wav, m4a, webm, ogg, etc.)
 * @param mimeType     MIME type of the audio, e.g. 'audio/mpeg'
 * @param filename     Filename with extension — Whisper uses extension for codec detection
 * @param language     Optional BCP-47 language hint (e.g. 'en', 'fr', 'ht').
 *                     Unsupported codes are remapped (ht→fr) or dropped.
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

  const whisperLanguage = resolveWhisperLanguage(language);

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  formData.append('file', blob, filename);
  formData.append('model', env.OPENAI_WHISPER_MODEL);
  formData.append('response_format', 'verbose_json');
  if (whisperLanguage) {
    // whisperLanguage is already validated/remapped (e.g. 'ht' → 'fr')
    formData.append('language', whisperLanguage);
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
