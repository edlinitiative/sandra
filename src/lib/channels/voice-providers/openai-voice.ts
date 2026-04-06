/**
 * OpenAI voice provider.
 *
 * STT: OpenAI Whisper API  (/v1/audio/transcriptions)
 * TTS: OpenAI TTS API      (/v1/audio/speech)
 *
 * Extracted from the original voice.ts — same logic, now behind the
 * VoiceProvider interface.
 */

import { env } from '@/lib/config';
import { createLogger } from '@/lib/utils';
import type {
  VoiceProvider,
  TranscribeOptions,
  TranscriptionResult,
  SynthesizeOptions,
  TtsVoice,
} from './types';

const log = createLogger('voice:openai');

// ─── Whisper language support ─────────────────────────────────────────────────

const WHISPER_LANGUAGE_REMAP: Record<string, string> = {
  ht: 'fr', // Haitian Creole → French (closest supported language)
};

const WHISPER_SUPPORTED_LANGUAGES = new Set([
  'af', 'ar', 'hy', 'az', 'be', 'bs', 'bg', 'ca', 'zh', 'hr', 'cs', 'da',
  'nl', 'en', 'et', 'fi', 'fr', 'gl', 'de', 'el', 'he', 'hi', 'hu', 'is',
  'id', 'it', 'ja', 'kn', 'kk', 'ko', 'lv', 'lt', 'mk', 'ms', 'mr', 'mi',
  'ne', 'no', 'fa', 'pl', 'pt', 'ro', 'ru', 'sr', 'sk', 'sl', 'es', 'sw',
  'sv', 'tl', 'ta', 'th', 'tr', 'uk', 'ur', 'vi', 'cy',
]);

function resolveWhisperLanguage(language: string | undefined): string | undefined {
  if (!language) return undefined;
  const base = language.toLowerCase().split('-')[0];
  if (!base) return undefined;
  const remapped = WHISPER_LANGUAGE_REMAP[base] ?? base;
  return WHISPER_SUPPORTED_LANGUAGES.has(remapped) ? remapped : undefined;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class OpenAIVoiceProvider implements VoiceProvider {
  readonly name = 'openai';

  isConfigured(): boolean {
    const key = env.OPENAI_API_KEY;
    return !!key && key.length >= 10 && !key.startsWith('sk-your') && key !== 'change-me';
  }

  async transcribe(options: TranscribeOptions): Promise<TranscriptionResult> {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const whisperLanguage = resolveWhisperLanguage(options.language);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(options.audioBuffer)], { type: options.mimeType });
    formData.append('file', blob, options.filename);
    formData.append('model', env.OPENAI_WHISPER_MODEL);
    formData.append('response_format', 'verbose_json');
    if (whisperLanguage) {
      formData.append('language', whisperLanguage);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      log.error('Whisper STT failed', { status: response.status });
      throw new Error(`Whisper API error: HTTP ${response.status} — ${err}`);
    }

    const json = (await response.json()) as { text: string; language?: string };
    return { text: json.text.trim(), language: json.language };
  }

  async synthesize(options: SynthesizeOptions): Promise<Buffer> {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const voice = options.voice ?? (env.OPENAI_TTS_VOICE as TtsVoice);
    const format = options.format ?? 'mp3';

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_TTS_MODEL,
        input: options.text,
        voice,
        response_format: format,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      log.error('OpenAI TTS failed', { status: response.status });
      throw new Error(`TTS API error: HTTP ${response.status} — ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
