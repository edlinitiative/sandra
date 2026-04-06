/**
 * Voice provider type definitions.
 *
 * Vendor-agnostic interfaces for Speech-to-Text (STT) and Text-to-Speech (TTS).
 * Each voice provider implements these to enable automatic fallback.
 */

// ─── STT ──────────────────────────────────────────────────────────────────────

export interface TranscriptionResult {
  text: string;
  language?: string;
}

export interface TranscribeOptions {
  /** Raw audio bytes */
  audioBuffer: Buffer;
  /** MIME type of the audio, e.g. 'audio/mpeg' */
  mimeType: string;
  /** Filename with extension — some providers use it for codec detection */
  filename: string;
  /** Optional BCP-47 language hint (e.g. 'en', 'fr', 'ht') */
  language?: string;
}

// ─── TTS ──────────────────────────────────────────────────────────────────────

export type TtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TtsFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav';

export interface SynthesizeOptions {
  /** Text to speak */
  text: string;
  /** Voice ID — provider maps this to its native voice set */
  voice?: TtsVoice;
  /** Output format — defaults to 'mp3' */
  format?: TtsFormat;
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface VoiceProvider {
  readonly name: string;

  /** Transcribe audio → text (STT) */
  transcribe(options: TranscribeOptions): Promise<TranscriptionResult>;

  /** Synthesize text → audio (TTS) */
  synthesize(options: SynthesizeOptions): Promise<Buffer>;

  /** Check whether this provider is configured and usable */
  isConfigured(): boolean;
}
