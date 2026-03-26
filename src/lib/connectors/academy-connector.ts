import type { Connector, ConnectorHealth, ConnectorInfo } from './types';

/**
 * EdLight Academy Connector — represents the connection to the EdLight Academy platform.
 * Currently reads data from indexed GitHub content. Will evolve to connect to a live API.
 */
export class AcademyConnector implements Connector {
  readonly id = 'edlight-academy';
  readonly name = 'EdLight Academy';
  readonly description = 'Educational platform offering structured courses in technology, business, and creative fields.';
  readonly platform = 'edlight-academy';
  readonly version = '1.0.0';
  readonly capabilities = ['course-catalog', 'learning-paths', 'content-discovery'];

  /** Academy URL for link generation */
  readonly baseUrl = 'https://academy.edlight.org';

  isConfigured(): boolean {
    // Academy data is sourced from indexed GitHub content — always available if indexed
    return true;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    // Academy is currently sourced from indexed content, so health = repo indexed
    return {
      status: 'connected',
      lastChecked: new Date(),
      details: { source: 'indexed-github-content', repo: 'edlinitiative/EdLight-Academy' },
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
