/**
 * Google Workspace Connector — provides access to Google Drive, Gmail,
 * and Directory for multi-tenant organizations.
 *
 * Health check validates service account credentials for the default tenant.
 * Unlike static connectors, this one requires a ConnectedProvider in the DB.
 */

import type { Connector, ConnectorHealth, ConnectorInfo } from './types';
import { db } from '@/lib/db';
import { validateCredentials } from '@/lib/google/auth';
import type { GoogleServiceAccountCredentials, GoogleWorkspaceConfig } from '@/lib/google/types';

export class GoogleWorkspaceConnector implements Connector {
  readonly id = 'google-workspace';
  readonly name = 'Google Workspace';
  readonly description =
    'Access Google Drive files, Gmail sending, and Directory contacts for connected organizations via domain-wide delegation.';
  readonly platform = 'google';
  readonly version = '1.0.0';
  readonly capabilities = [
    'drive-read',
    'drive-search',
    'gmail-send',
    'gmail-draft',
    'directory-list',
    'directory-lookup',
  ];

  isConfigured(): boolean {
    // This connector is configured if at least one active google_workspace
    // provider exists. We check synchronously by returning true and letting
    // healthCheck do the async validation.
    return true;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();

    try {
      // Find the first active Google Workspace provider
      const provider = await db.connectedProvider.findFirst({
        where: { provider: 'google_workspace', isActive: true },
        include: { tenant: { select: { name: true, slug: true } } },
      });

      if (!provider) {
        return {
          status: 'disconnected',
          latencyMs: Date.now() - start,
          lastChecked: new Date(),
          details: { error: 'No active Google Workspace provider configured' },
        };
      }

      const credentials = provider.credentials as unknown as GoogleServiceAccountCredentials;
      const config = (provider.config ?? {}) as unknown as GoogleWorkspaceConfig;

      if (!credentials.client_email || !credentials.private_key) {
        return {
          status: 'disconnected',
          latencyMs: Date.now() - start,
          lastChecked: new Date(),
          details: { error: 'Invalid service account credentials', tenant: provider.tenant.slug },
        };
      }

      const result = await validateCredentials(credentials, config.adminEmail);

      // Update provider health status
      await db.connectedProvider.update({
        where: { id: provider.id },
        data: {
          lastHealthCheck: new Date(),
          lastHealthStatus: result.valid ? 'connected' : 'disconnected',
        },
      });

      return {
        status: result.valid ? 'connected' : 'disconnected',
        latencyMs: result.latencyMs,
        lastChecked: new Date(),
        details: {
          tenant: provider.tenant.slug,
          serviceAccount: credentials.client_email,
          domain: config.domain,
          ...(result.error ? { error: result.error } : {}),
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
