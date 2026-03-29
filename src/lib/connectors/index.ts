export type {
  Connector,
  ConnectorHealth,
  ConnectorInfo,
  ConnectorStatus,
} from './types';
export { connectorRegistry, getConnectorRegistry } from './types';
export { GitHubConnector } from './github-connector';
export { DatabaseConnector } from './database-connector';
export { OpenAIConnector } from './openai-connector';
export { AcademyConnector } from './academy-connector';
export { CodeConnector } from './code-connector';
export { NewsConnector } from './news-connector';
export { InitiativeConnector } from './initiative-connector';

import { connectorRegistry } from './types';
import { GitHubConnector } from './github-connector';
import { DatabaseConnector } from './database-connector';
import { OpenAIConnector } from './openai-connector';
import { AcademyConnector } from './academy-connector';
import { CodeConnector } from './code-connector';
import { NewsConnector } from './news-connector';
import { InitiativeConnector } from './initiative-connector';

/**
 * Register all default connectors.
 * Called once at module load time.
 */
function registerDefaultConnectors(): void {
  const defaults = [
    new GitHubConnector(),
    new DatabaseConnector(),
    new OpenAIConnector(),
    new AcademyConnector(),
    new CodeConnector(),
    new NewsConnector(),
    new InitiativeConnector(),
  ];

  for (const connector of defaults) {
    if (!connectorRegistry.has(connector.id)) {
      connectorRegistry.register(connector);
    }
  }
}

registerDefaultConnectors();
