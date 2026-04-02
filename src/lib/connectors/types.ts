import { createLogger } from '@/lib/utils';

const log = createLogger('connectors');

// ─── Connector Types ────────────────────────────────────────────────────────

/** Status of a connector's connection to its backing service. */
export type ConnectorStatus = 'connected' | 'disconnected' | 'degraded' | 'unknown';

/** Health information returned by a connector. */
export interface ConnectorHealth {
  status: ConnectorStatus;
  latencyMs?: number;
  lastChecked: Date;
  details?: Record<string, unknown>;
}

/** Metadata describing a connector. */
export interface ConnectorInfo {
  id: string;
  name: string;
  description: string;
  platform: string;
  version: string;
  capabilities: string[];
  health: ConnectorHealth;
}

/**
 * Abstract base interface for all EdLight connectors.
 * Each connector represents a connection to an EdLight platform or external service.
 */
export interface Connector {
  /** Unique connector ID */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Description of what this connector provides */
  readonly description: string;
  /** Platform this connects to */
  readonly platform: string;
  /** Connector version */
  readonly version: string;
  /** List of capabilities (e.g. 'course-catalog', 'user-auth') */
  readonly capabilities: string[];

  /** Check if the connector is properly configured */
  isConfigured(): boolean;

  /** Perform a health check against the backing service */
  healthCheck(): Promise<ConnectorHealth>;

  /** Get connector metadata */
  getInfo(): Promise<ConnectorInfo>;
}

// ─── Connector Registry ─────────────────────────────────────────────────────

class ConnectorRegistry {
  private connectors = new Map<string, Connector>();

  register(connector: Connector): void {
    if (this.connectors.has(connector.id)) {
      log.warn(`Connector '${connector.id}' already registered, replacing`);
    }
    this.connectors.set(connector.id, connector);
    log.info(`Registered connector: ${connector.id} (${connector.name})`);
  }

  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  getAll(): Connector[] {
    return Array.from(this.connectors.values());
  }

  has(id: string): boolean {
    return this.connectors.has(id);
  }

  /** Get connector metadata for all registered connectors. */
  async listConnectors(): Promise<ConnectorInfo[]> {
    const infos: ConnectorInfo[] = [];
    for (const connector of this.connectors.values()) {
      try {
        infos.push(await connector.getInfo());
      } catch (error) {
        infos.push({
          id: connector.id,
          name: connector.name,
          description: connector.description,
          platform: connector.platform,
          version: connector.version,
          capabilities: connector.capabilities,
          health: {
            status: 'unknown',
            lastChecked: new Date(),
            details: { error: error instanceof Error ? error.message : 'Health check failed' },
          },
        });
      }
    }
    return infos;
  }

  /** Run health checks on all connectors. */
  async healthCheckAll(): Promise<Record<string, ConnectorHealth>> {
    const results: Record<string, ConnectorHealth> = {};
    const checks = Array.from(this.connectors.entries()).map(async ([id, connector]) => {
      try {
        results[id] = await connector.healthCheck();
      } catch (error) {
        results[id] = {
          status: 'disconnected',
          lastChecked: new Date(),
          details: { error: error instanceof Error ? error.message : 'unknown' },
        };
      }
    });
    await Promise.all(checks);
    return results;
  }

  clear(): void {
    this.connectors.clear();
  }
}

export const connectorRegistry = new ConnectorRegistry();

export function getConnectorRegistry(): ConnectorRegistry {
  return connectorRegistry;
}
