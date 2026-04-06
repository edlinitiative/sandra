/**
 * Google Gemini voice provider.
 *
 * STT: Gemini multimodal — send audio as inline data and prompt for transcription.
 *      Uses gemini-2.0-flash for fast, cost-efficient transcription.
 *
 * TTS: Gemini TTS — uses gemini-2.5-flash-preview-tts with response_modalities=["AUDIO"].
 *      Returns 24 kHz 16-bit PCM WAV data which we convert to the requested format.
 *
 * Both use the same GEMINI_API_KEY via the REST API (the @google/generative-ai
 * SDK v0.24 doesn't expose speechConfig or responseModalities yet).
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

const log = createLogger('voice:gemini');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Map our TtsVoice names to Gemini's prebuilt voice names */
const VOICE_MAP: Record<TtsVoice, string> = {
  alloy:   'Kore',      // Firm, neutral
  echo:    'Charon',    // Informative
  fable:   'Aoede',     // Breezy
  onyx:    'Orus',      // Firm, deep
  nova:    'Leda',      // Youthful
  shimmer: 'Zephyr',    // Bright
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export class GeminiVoiceProvider implements VoiceProvider {
  readonly name = 'gemini';

  isConfigured(): boolean {
    return !!env.GEMINI_API_KEY && env.GEMINI_API_KEY.length >= 10;
  }

  // ── STT via Gemini multimodal ──────────────────────────────────────────────

  async transcribe(options: TranscribeOptions): Promise<TranscriptionResult> {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const model = env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    const base64Audio = options.audioBuffer.toString('base64');

    // Map MIME types — Gemini supports audio/mp3, audio/wav, audio/aac, audio/ogg, audio/flac
    const mimeType = normalizeAudioMime(options.mimeType);

    const languageHint = options.language
      ? ` The audio is in ${options.language}.`
      : '';

    const body = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Audio,
              },
            },
            {
              text: `Transcribe this audio exactly as spoken. Return only the transcription text, nothing else. Do not add any commentary, labels, or formatting.${languageHint}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
      },
    };

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      log.error('Gemini STT failed', { status: response.status });
      throw new Error(`Gemini STT error: HTTP ${response.status} — ${err}`);
    }

    const json = (await response.json()) as GeminiGenerateResponse;
    const text = json.candidates?.[0]?.content?.parts
      ?.filter((p): p is { text: string } => 'text' in p)
      .map((p) => p.text)
      .join('')
      .trim();

    if (!text) {
      throw new Error('Gemini STT returned empty transcription');
    }

    return { text };
  }

  // ── TTS via Gemini TTS model ───────────────────────────────────────────────

  async synthesize(options: SynthesizeOptions): Promise<Buffer> {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const model = env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-preview-tts';
    const voiceName = VOICE_MAP[options.voice ?? 'alloy'] ?? 'Kore';

    const body = {
      contents: [
        {
          parts: [
            {
              text: options.text,
            },
          ],
        },
      ],
      generationConfig: {
        response_modalities: ['AUDIO'],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: voiceName,
            },
          },
        },
      },
    };

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      log.error('Gemini TTS failed', { status: response.status });
      throw new Error(`Gemini TTS error: HTTP ${response.status} — ${err}`);
    }

    const json = (await response.json()) as GeminiGenerateResponse;
    const audioPart = json.candidates?.[0]?.content?.parts?.find(
      (p): p is { inline_data: { mime_type: string; data: string } } =>
        'inline_data' in p,
    );

    if (!audioPart) {
      throw new Error('Gemini TTS returned no audio data');
    }

    // Gemini TTS returns raw 24 kHz 16-bit PCM as base64.
    // Wrap it in a WAV header so callers get a playable file.
    const pcmBuffer = Buffer.from(audioPart.inline_data.data, 'base64');

    // If caller wanted wav or the raw PCM, wrap in WAV header
    // For mp3/opus/aac/flac, we still return WAV (the route can transcode if needed,
    // but WAV is universally playable and avoids an ffmpeg dependency).
    return wrapPcmAsWav(pcmBuffer, 24000, 1, 16);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize MIME types to ones Gemini supports */
function normalizeAudioMime(mime: string): string {
  const map: Record<string, string> = {
    'audio/mpeg': 'audio/mp3',
    'audio/x-wav': 'audio/wav',
    'audio/m4a': 'audio/mp4',
    'audio/x-m4a': 'audio/mp4',
    'video/webm': 'audio/webm',
  };
  return map[mime] ?? mime;
}

/** Wrap raw PCM samples in a minimal WAV header */
function wrapPcmAsWav(
  pcm: Buffer,
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const headerSize = 44;

  const header = Buffer.alloc(headerSize);
  header.write('RIFF', 0);                           // ChunkID
  header.writeUInt32LE(dataSize + headerSize - 8, 4); // ChunkSize
  header.write('WAVE', 8);                            // Format
  header.write('fmt ', 12);                           // Subchunk1ID
  header.writeUInt32LE(16, 16);                       // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20);                        // AudioFormat (PCM = 1)
  header.writeUInt16LE(channels, 22);                 // NumChannels
  header.writeUInt32LE(sampleRate, 24);               // SampleRate
  header.writeUInt32LE(byteRate, 28);                 // ByteRate
  header.writeUInt16LE(blockAlign, 32);               // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);            // BitsPerSample
  header.write('data', 36);                           // Subchunk2ID
  header.writeUInt32LE(dataSize, 40);                 // Subchunk2Size

  return Buffer.concat([header, pcm]);
}

// ─── Gemini API response types ────────────────────────────────────────────────

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<
        | { text: string }
        | { inline_data: { mime_type: string; data: string } }
      >;
    };
  }>;
}
