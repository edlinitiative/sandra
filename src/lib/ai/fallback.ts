/**
 * Fallback AI Provider — resilient multi-provider chain.
 *
 * Wraps multiple AIProvider implementations and automatically falls back to the
 * next provider when one fails with a retriable error (quota exceeded, rate
 * limit, server error, timeout, etc.).
 *
 * Non-retriable errors (auth failures, validation errors) are thrown immediately.
 *
 * Usage:
 *   const provider = new FallbackProvider([openaiProvider, geminiProvider, anthropicProvider]);
 *   const result = await provider.chatCompletion(request); // tries OpenAI first, then Gemini, then Anthropic
 */

import { createLogger, ProviderError } from '@/lib/utils';
import type {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  StreamChunk,
} from './types';

const log = createLogger('ai:fallback');

// ─── Error classification ──────────────────────────────────────────────────────

/** Error categories for deciding whether to fall back */
export type ProviderErrorCategory =
  | 'quota'       // billing / insufficient quota
  | 'rate_limit'  // too many requests
  | 'server'      // 5xx from the provider
  | 'timeout'     // request timed out
  | 'auth'        // invalid API key / 401 / 403
  | 'invalid'     // bad request / 400 (user's fault, not retriable)
  | 'unknown';    // catch-all

/**
 * Classify a ProviderError by inspecting its message and HTTP status codes.
 * Works across OpenAI, Anthropic, and Gemini error shapes.
 */
export function classifyProviderError(error: ProviderError): ProviderErrorCategory {
  const msg = error.message.toLowerCase();

  // Quota / billing
  if (
    msg.includes('insufficient_quota') ||
    msg.includes('quota') ||
    msg.includes('billing') ||
    msg.includes('exceeded your current') ||
    msg.includes('payment required') ||
    msg.includes('402')
  ) {
    return 'quota';
  }

  // Rate limit
  if (
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('429')
  ) {
    return 'rate_limit';
  }

  // Auth errors — not retriable via fallback
  if (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('invalid api key') ||
    msg.includes('invalid x-api-key') ||
    msg.includes('authentication') ||
    msg.includes('permission')
  ) {
    return 'auth';
  }

  // Server errors
  if (
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('internal server error') ||
    msg.includes('service unavailable') ||
    msg.includes('overloaded')
  ) {
    return 'server';
  }

  // Timeout
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnaborted')
  ) {
    return 'timeout';
  }

  // Bad request — not retriable
  if (msg.includes('400') || msg.includes('invalid request')) {
    return 'invalid';
  }

  return 'unknown';
}

/** Errors worth retrying on a different provider */
const RETRIABLE_CATEGORIES: Set<ProviderErrorCategory> = new Set([
  'quota',
  'rate_limit',
  'server',
  'timeout',
  'unknown', // err on the side of trying the next provider
]);

function isRetriable(error: ProviderError): boolean {
  return RETRIABLE_CATEGORIES.has(classifyProviderError(error));
}

// ─── Fallback Provider ─────────────────────────────────────────────────────────

export class FallbackProvider implements AIProvider {
  readonly name = 'fallback';
  private readonly providers: AIProvider[];
  /** Provider used for embeddings — first one that supports them (typically OpenAI) */
  private embeddingProvider: AIProvider | null = null;

  constructor(providers: AIProvider[]) {
    if (providers.length === 0) {
      throw new ProviderError('fallback', 'At least one AI provider must be configured');
    }
    this.providers = providers;
    log.info('Fallback provider initialized', {
      chain: providers.map((p) => p.name).join(' → '),
    });
  }

  /** The first (primary) provider in the chain */
  get primary(): AIProvider {
    return this.providers[0]!;
  }

  // ── Chat Completion ────────────────────────────────────────────────────────

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    let lastError: ProviderError | undefined;

    for (const provider of this.providers) {
      try {
        return await provider.chatCompletion(request);
      } catch (err) {
        const providerError =
          err instanceof ProviderError
            ? err
            : new ProviderError(provider.name, err instanceof Error ? err.message : 'Unknown error');

        const category = classifyProviderError(providerError);
        lastError = providerError;

        if (!isRetriable(providerError)) {
          log.warn(`Non-retriable error from ${provider.name} (${category}), not falling back`, {
            error: providerError.message,
          });
          throw providerError;
        }

        log.warn(`Provider ${provider.name} failed (${category}), trying next provider`, {
          error: providerError.message,
          remainingProviders: this.providers
            .slice(this.providers.indexOf(provider) + 1)
            .map((p) => p.name),
        });
      }
    }

    // All providers failed
    log.error('All providers exhausted', {
      chain: this.providers.map((p) => p.name).join(' → '),
      lastError: lastError?.message,
    });
    throw lastError ?? new ProviderError('fallback', 'All AI providers failed');
  }

  // ── Streaming Chat Completion ──────────────────────────────────────────────

  async *streamChatCompletion(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    let lastError: ProviderError | undefined;

    for (const provider of this.providers) {
      try {
        yield* provider.streamChatCompletion(request);
        return; // success — stop trying
      } catch (err) {
        const providerError =
          err instanceof ProviderError
            ? err
            : new ProviderError(provider.name, err instanceof Error ? err.message : 'Unknown error');

        const category = classifyProviderError(providerError);
        lastError = providerError;

        if (!isRetriable(providerError)) {
          throw providerError;
        }

        log.warn(`Stream: provider ${provider.name} failed (${category}), trying next`, {
          error: providerError.message,
        });
      }
    }

    throw lastError ?? new ProviderError('fallback', 'All AI providers failed');
  }

  // ── Embeddings — route to the configured or first capable provider ─────
  // OpenAI and Gemini support embeddings. Anthropic does not.

  /** Providers known to support embeddings */
  private static readonly EMBEDDING_CAPABLE = new Set(['openai', 'gemini']);

  private resolveEmbeddingProvider(): AIProvider {
    if (this.embeddingProvider) return this.embeddingProvider;

    // Honour explicit EMBEDDING_PROVIDER env var
    const preferred = process.env.EMBEDDING_PROVIDER;
    if (preferred) {
      for (const provider of this.providers) {
        if (provider.name === preferred && FallbackProvider.EMBEDDING_CAPABLE.has(provider.name)) {
          this.embeddingProvider = provider;
          log.info(`Embedding provider resolved (env): ${provider.name}`);
          return provider;
        }
      }
      log.warn(`Configured EMBEDDING_PROVIDER="${preferred}" not found or not capable, falling back to auto-detect`);
    }

    for (const provider of this.providers) {
      if (FallbackProvider.EMBEDDING_CAPABLE.has(provider.name)) {
        this.embeddingProvider = provider;
        log.info(`Embedding provider resolved: ${provider.name}`);
        return provider;
      }
    }

    // No known embedding-capable provider — try primary and let the error propagate
    log.warn('No embedding-capable provider found in chain, using primary');
    this.embeddingProvider = this.primary;
    return this.primary;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.resolveEmbeddingProvider().generateEmbedding(text);
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.resolveEmbeddingProvider().generateEmbeddings(request);
  }

  // ── Health Check ───────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    for (const provider of this.providers) {
      if (await provider.healthCheck()) return true;
    }
    return false;
  }
}
