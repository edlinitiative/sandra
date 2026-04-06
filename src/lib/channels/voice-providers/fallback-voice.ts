/**
 * Fallback voice provider.
 *
 * Wraps multiple VoiceProvider implementations and automatically falls back
 * to the next provider when one fails with a retriable error (quota, rate
 * limit, server error, timeout).
 *
 * Uses the same error-classification logic as the AI provider fallback.
 */

import { createLogger } from '@/lib/utils';
import type {
  VoiceProvider,
  TranscribeOptions,
  TranscriptionResult,
  SynthesizeOptions,
} from './types';

const log = createLogger('voice:fallback');

/** Check whether an error is worth retrying on a different provider */
function isRetriable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : '';
  // Quota / billing
  if (msg.includes('quota') || msg.includes('billing') || msg.includes('402') || msg.includes('insufficient')) return true;
  // Rate limit
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) return true;
  // Server errors
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('overloaded')) return true;
  // Timeout
  if (msg.includes('timeout') || msg.includes('timed out')) return true;
  return false;
}

export class FallbackVoiceProvider implements VoiceProvider {
  readonly name = 'fallback';
  private readonly providers: VoiceProvider[];

  constructor(providers: VoiceProvider[]) {
    if (providers.length === 0) {
      throw new Error('At least one voice provider must be configured');
    }
    this.providers = providers;
    log.info('Voice fallback chain initialized', {
      chain: providers.map((p) => p.name).join(' → '),
    });
  }

  isConfigured(): boolean {
    return this.providers.some((p) => p.isConfigured());
  }

  async transcribe(options: TranscribeOptions): Promise<TranscriptionResult> {
    let lastError: Error | undefined;

    for (const provider of this.providers) {
      try {
        return await provider.transcribe(options);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (!isRetriable(err)) {
          log.warn(`STT: non-retriable error from ${provider.name}, not falling back`, {
            error: lastError.message,
          });
          throw lastError;
        }

        log.warn(`STT: ${provider.name} failed, trying next provider`, {
          error: lastError.message,
        });
      }
    }

    throw lastError ?? new Error('All voice STT providers failed');
  }

  async synthesize(options: SynthesizeOptions): Promise<Buffer> {
    let lastError: Error | undefined;

    for (const provider of this.providers) {
      try {
        return await provider.synthesize(options);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (!isRetriable(err)) {
          log.warn(`TTS: non-retriable error from ${provider.name}, not falling back`, {
            error: lastError.message,
          });
          throw lastError;
        }

        log.warn(`TTS: ${provider.name} failed, trying next provider`, {
          error: lastError.message,
        });
      }
    }

    throw lastError ?? new Error('All voice TTS providers failed');
  }
}
