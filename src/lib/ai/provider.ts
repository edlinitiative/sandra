import type { AIProvider } from './types';
import { OpenAIProvider } from './openai';
import { ConfigurationError, createLogger } from '@/lib/utils';

const log = createLogger('ai:provider');

type ProviderName = 'openai' | 'anthropic' | 'google';

const providerFactories: Record<ProviderName, () => AIProvider> = {
  openai: () => new OpenAIProvider(),
  // Future providers — add factory functions here
  anthropic: () => {
    throw new ConfigurationError('Anthropic provider not yet implemented');
  },
  google: () => {
    throw new ConfigurationError('Google provider not yet implemented');
  },
};

let defaultProvider: AIProvider | null = null;

/**
 * Get or create the default AI provider instance (singleton).
 */
export function getAIProvider(name: ProviderName = 'openai'): AIProvider {
  if (defaultProvider && defaultProvider.name === name) return defaultProvider;

  const factory = providerFactories[name];
  if (!factory) {
    throw new ConfigurationError(`Unknown AI provider: ${name}`);
  }

  log.info(`Initializing AI provider: ${name}`);
  defaultProvider = factory();
  return defaultProvider;
}

/**
 * Register a custom provider (for testing or future vendors).
 */
export function registerAIProvider(name: string, factory: () => AIProvider): void {
  (providerFactories as Record<string, () => AIProvider>)[name] = factory;
  log.info(`Registered custom AI provider: ${name}`);
}
