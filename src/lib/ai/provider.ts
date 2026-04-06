import type { AIProvider } from './types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { FallbackProvider } from './fallback';
import { ConfigurationError, createLogger } from '@/lib/utils';
import { env } from '@/lib/config';

const log = createLogger('ai:provider');

type ProviderName = 'openai' | 'anthropic' | 'gemini';

const providerFactories: Record<ProviderName, () => AIProvider> = {
  openai:    () => new OpenAIProvider(),
  anthropic: () => new AnthropicProvider(),
  gemini:    () => new GeminiProvider(),
};

let defaultProvider: AIProvider | null = null;

/**
 * Check whether a provider has a valid API key configured.
 */
function isProviderConfigured(name: ProviderName): boolean {
  switch (name) {
    case 'openai': {
      const key = env.OPENAI_API_KEY;
      return !!key && key.length >= 10 && !key.startsWith('sk-your') && key !== 'change-me';
    }
    case 'anthropic':
      return !!env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.length >= 10;
    case 'gemini':
      return !!env.GEMINI_API_KEY && env.GEMINI_API_KEY.length >= 10;
    default:
      return false;
  }
}

/**
 * Build the provider fallback chain from AI_PROVIDER_PRIORITY config.
 *
 * Only providers with valid API keys are included. If multiple providers
 * are available, they are wrapped in a FallbackProvider that automatically
 * tries the next one on quota / rate-limit / server errors.
 */
function buildProviderChain(): AIProvider {
  const priorityStr = env.AI_PROVIDER_PRIORITY ?? 'openai,gemini,anthropic';
  const priority = priorityStr
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderName => s in providerFactories);

  const available: AIProvider[] = [];

  for (const name of priority) {
    if (!isProviderConfigured(name)) {
      log.info(`Skipping provider ${name} — not configured`);
      continue;
    }
    try {
      available.push(providerFactories[name]());
      log.info(`Provider ${name} added to chain`);
    } catch (err) {
      log.warn(`Failed to initialize provider ${name}`, {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  if (available.length === 0) {
    log.warn('No AI providers configured — falling back to OpenAI (may fail)');
    return new OpenAIProvider();
  }

  if (available.length === 1) {
    return available[0]!;
  }

  return new FallbackProvider(available);
}

/**
 * Get or create the default AI provider instance (singleton).
 *
 * When called without arguments, builds a fallback chain from all configured
 * providers. Pass a specific provider name to get just that provider.
 */
export function getAIProvider(name?: ProviderName): AIProvider {
  // Specific provider requested
  if (name) {
    const factory = providerFactories[name];
    if (!factory) {
      throw new ConfigurationError(`Unknown AI provider: ${name}`);
    }
    return factory();
  }

  // Return cached default
  if (defaultProvider) return defaultProvider;

  // Build the fallback chain
  defaultProvider = buildProviderChain();
  return defaultProvider;
}

/**
 * Register a custom provider (for testing or future vendors).
 */
export function registerAIProvider(name: string, factory: () => AIProvider): void {
  (providerFactories as Record<string, () => AIProvider>)[name] = factory;
  log.info(`Registered custom AI provider: ${name}`);
}

/**
 * Reset the cached provider (useful for testing).
 */
export function resetAIProvider(): void {
  defaultProvider = null;
}
