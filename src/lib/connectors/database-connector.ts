import type { Connector, ConnectorHealth, ConnectorInfo } from './types';
import { db } from '@/lib/db';

/**
 * Database Connector — provides access to the Sandra PostgreSQL database
 * (users, sessions, enrollments, certificates, applications, audit logs).
 */
export class DatabaseConnector implements Connector {
  readonly id = 'database';
  readonly name = 'Sandra Database';
  readonly description = 'PostgreSQL database for user records, sessions, enrollments, certificates, and audit logs.';
  readonly platform = 'postgresql';
  readonly version = '1.0.0';
  readonly capabilities = ['user-records', 'session-storage', 'enrollment-data', 'certificate-data', 'audit-logs', 'vector-search'];

  isConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL);
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      return {
        status: 'connected',
        latencyMs: Date.now() - start,
        lastChecked: new Date(),
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
    let details: Record<string, unknown> = {};

    if (health.status === 'connected') {
      try {
        const [users, sessions, repos] = await Promise.all([
          db.user.count(),
          db.session.count(),
          db.repoRegistry.count({ where: { isActive: true } }),
        ]);
        details = { userCount: users, sessionCount: sessions, activeRepos: repos };
      } catch {
        // Best effort
      }
    }

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      platform: this.platform,
      version: this.version,
      capabilities: this.capabilities,
      health: { ...health, details: { ...health.details, ...details } },
    };
  }
}
