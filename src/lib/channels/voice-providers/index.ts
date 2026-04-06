/**
 * Voice provider barrel export and singleton factory.
 *
 * Builds a fallback chain of voice providers from the configured API keys,
 * following the same priority logic as the AI provider chain.
 */

export type { VoiceProvider, TranscribeOptions, TranscriptionResult, SynthesizeOptions, TtsVoice, TtsFormat } from './types';
export { OpenAIVoiceProvider } from './openai-voice';
export { GeminiVoiceProvider } from './gemini-voice';
export { FallbackVoiceProvider } from './fallback-voice';

import { createLogger } from '@/lib/utils';
import { OpenAIVoiceProvider } from './openai-voice';
import { GeminiVoiceProvider } from './gemini-voice';
import { FallbackVoiceProvider } from './fallback-voice';
import type { VoiceProvider } from './types';

const log = createLogger('voice:provider');

let _voiceProvider: VoiceProvider | null = null;

/**
 * Get the voice provider singleton.
 *
 * Builds a fallback chain: OpenAI (Whisper + TTS) → Gemini (multimodal STT + TTS).
 * Only providers with valid API keys are included.
 */
export function getVoiceProvider(): VoiceProvider {
  if (_voiceProvider) return _voiceProvider;

  const candidates: VoiceProvider[] = [];

  const openai = new OpenAIVoiceProvider();
  if (openai.isConfigured()) {
    candidates.push(openai);
    log.info('Voice provider: OpenAI added to chain');
  }

  const gemini = new GeminiVoiceProvider();
  if (gemini.isConfigured()) {
    candidates.push(gemini);
    log.info('Voice provider: Gemini added to chain');
  }

  if (candidates.length === 0) {
    log.warn('No voice providers configured — falling back to OpenAI (may fail)');
    candidates.push(openai);
  }

  _voiceProvider =
    candidates.length === 1 ? candidates[0]! : new FallbackVoiceProvider(candidates);

  return _voiceProvider;
}

/** Reset the cached provider (for testing) */
export function resetVoiceProvider(): void {
  _voiceProvider = null;
}
