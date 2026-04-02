import type { Connector, ConnectorHealth, ConnectorInfo } from './types';
import { getGitHubClient } from '@/lib/github';
import { env } from '@/lib/config';

/**
 * GitHub Connector — provides access to EdLight repositories via GitHub API.
 */
export class GitHubConnector implements Connector {
  readonly id = 'github';
  readonly name = 'GitHub';
  readonly description = 'Access to EdLight organization repositories, code, and documentation via GitHub API.';
  readonly platform = 'github';
  readonly version = '1.0.0';
  readonly capabilities = ['repo-listing', 'file-content', 'readme-fetch', 'docs-indexing'];

  isConfigured(): boolean {
    return Boolean(env.GITHUB_TOKEN && env.GITHUB_TOKEN.length > 10);
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      const client = getGitHubClient();
      const ok = await client.healthCheck();
      return {
        status: ok ? 'connected' : 'disconnected',
        latencyMs: Date.now() - start,
        lastChecked: new Date(),
        details: { authenticated: this.isConfigured() },
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
