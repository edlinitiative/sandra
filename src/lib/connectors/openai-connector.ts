import type { Connector, ConnectorHealth, ConnectorInfo } from './types';
import { env } from '@/lib/config';

/**
 * OpenAI Connector — provides access to chat completion and embeddings APIs.
 */
export class OpenAIConnector implements Connector {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly description = 'AI provider for chat completions (GPT-4o) and text embeddings (text-embedding-3-small).';
  readonly platform = 'openai';
  readonly version = '1.0.0';
  readonly capabilities = ['chat-completion', 'text-embedding', 'tool-calling', 'streaming'];

  isConfigured(): boolean {
    const key = env.OPENAI_API_KEY;
    return Boolean(key && key.length > 10 && !key.startsWith('sk-your') && key !== 'change-me');
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();

    if (!this.isConfigured()) {
      return {
        status: 'disconnected',
        latencyMs: 0,
        lastChecked: new Date(),
        details: { reason: 'API key not configured' },
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      return {
        status: response.ok ? 'connected' : 'degraded',
        latencyMs: Date.now() - start,
        lastChecked: new Date(),
        details: {
          model: env.OPENAI_MODEL,
          embeddingModel: env.OPENAI_EMBEDDING_MODEL,
          httpStatus: response.status,
        },
      };
    } catch (error) {
      return {
        status: 'disconnected',
        latencyMs: Date.now() - start,
        lastChecked: new Date(),
        details: { error: error instanceof Error ? error.message : 'unknown' },
      };
    }
  }

  async getInfo(): Promise<ConnectorInfo> {
    const health = await this.healthCheck();
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      platform: this.platform,
      version: this.version,
      capabilities: this.capabilities,
      health,
    };
  }
}
