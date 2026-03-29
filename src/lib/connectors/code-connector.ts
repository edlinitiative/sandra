import type { Connector, ConnectorHealth, ConnectorInfo } from './types';

/**
 * EdLight Code Connector — represents the connection to the EdLight Code platform.
 * Currently reads data from indexed GitHub content. Will evolve to connect to a live API.
 */
export class CodeConnector implements Connector {
  readonly id = 'edlight-code';
  readonly name = 'EdLight Code';
  readonly description = 'Core EdLight codebase and platform for software development learning and projects.';
  readonly platform = 'edlight-code';
  readonly version = '1.0.0';
  readonly capabilities = ['project-catalog', 'code-content', 'documentation'];

  readonly baseUrl = 'https://code.edlight.org';

  isConfigured(): boolean {
    return true;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      status: 'connected',
      lastChecked: new Date(),
      details: { source: 'indexed-github-content', repo: 'edlinitiative/code' },
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
