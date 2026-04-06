/**
 * Voice channel adapter.
 *
 * STT and TTS now route through the voice provider abstraction which supports
 * automatic fallback: OpenAI (Whisper + TTS) → Google Gemini (multimodal STT + TTS).
 *
 * The top-level `transcribeAudio()` and `synthesizeSpeech()` functions are
 * backward-compatible convenience wrappers that delegate to the active provider chain.
 */

import type { ChannelAdapter, InboundMessage, OutboundMessage } from './types';
import { formatForVoice } from './voice-formatter';
import { getVoiceProvider } from './voice-providers';
import type { TtsVoice, TtsFormat } from './voice-providers';

// Re-export types for backward compatibility
export type { TranscriptionResult, TtsVoice, TtsFormat } from './voice-providers';

// ─── STT (delegates to provider chain) ────────────────────────────────────────

/**
 * Transcribe an audio buffer using the configured voice provider chain.
 *
 * Tries OpenAI Whisper first; falls back to Gemini multimodal STT if
 * Whisper fails with a retriable error (quota, rate limit, server error).
 *
 * @param audioBuffer  Raw audio bytes (mp3, wav, m4a, webm, ogg, etc.)
 * @param mimeType     MIME type of the audio, e.g. 'audio/mpeg'
 * @param filename     Filename with extension — some providers use it for codec detection
 * @param language     Optional BCP-47 language hint (e.g. 'en', 'fr', 'ht').
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  filename: string,
  language?: string,
): Promise<{ text: string; language?: string }> {
  const provider = getVoiceProvider();
  return provider.transcribe({ audioBuffer, mimeType, filename, language });
}

// ─── TTS (delegates to provider chain) ────────────────────────────────────────

/**
 * Synthesize speech from text using the configured voice provider chain.
 *
 * Tries OpenAI TTS first; falls back to Gemini TTS if OpenAI fails
 * with a retriable error.
 *
 * @param text    The text to speak.
 * @param voice   Voice ID — defaults to 'alloy'
 * @param format  Audio format — defaults to 'mp3'
 * @returns       Audio bytes as a Buffer
 */
export async function synthesizeSpeech(
  text: string,
  voice?: TtsVoice,
  format: TtsFormat = 'mp3',
): Promise<Buffer> {
  const provider = getVoiceProvider();
  return provider.synthesize({ text, voice, format });
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
   * Voice is available when at least one voice provider (OpenAI or Gemini) is configured.
   */
  isConfigured(): boolean {
    return getVoiceProvider().isConfigured();
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
