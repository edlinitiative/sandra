import type { Connector, ConnectorHealth, ConnectorInfo } from './types';

/**
 * EdLight News Connector — represents the connection to the EdLight News platform.
 */
export class NewsConnector implements Connector {
  readonly id = 'edlight-news';
  readonly name = 'EdLight News';
  readonly description = 'News and updates platform for the EdLight community.';
  readonly platform = 'edlight-news';
  readonly version = '1.0.0';
  readonly capabilities = ['news-feed', 'article-content'];

  readonly baseUrl = 'https://news.edlight.org';

  isConfigured(): boolean {
    return true;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      status: 'connected',
      lastChecked: new Date(),
      details: { source: 'indexed-github-content', repo: 'edlinitiative/EdLight-News' },
    };
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
