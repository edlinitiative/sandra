import { z } from 'zod';
import { toolRegistry } from './registry';
import type { ToolResult, ToolContext } from './types';
import { getConnectorRegistry } from '@/lib/connectors';
import { createLogger } from '@/lib/utils';

const log = createLogger('tools:list-systems');

const inputSchema = z.object({}).strict();

async function handler(_input: unknown, context: ToolContext): Promise<ToolResult> {
  log.info('Listing connected systems', { sessionId: context.sessionId });

  try {
    const registry = getConnectorRegistry();
    const connectors = await registry.listConnectors();

    const systems = connectors.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      platform: c.platform,
      version: c.version,
      capabilities: c.capabilities,
      status: c.health.status,
      latencyMs: c.health.latencyMs ?? null,
      lastChecked: c.health.lastChecked.toISOString(),
    }));

    const summary = {
      total: systems.length,
      connected: systems.filter((s) => s.status === 'connected').length,
      degraded: systems.filter((s) => s.status === 'degraded').length,
      disconnected: systems.filter((s) => s.status === 'disconnected').length,
    };

    return {
      success: true,
      data: { systems, summary },
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to list connected systems',
    };
  }
}

toolRegistry.register({
  name: 'listConnectedSystems',
  description:
    'List all connected EdLight systems and external services with their health status. Includes GitHub, database, OpenAI, and EdLight platform connectors. Requires admin scope.',
  parameters: {
    type: 'object',
    properties: {},
  },
  inputSchema,
  requiredScopes: ['admin:tools'],
  handler,
});
