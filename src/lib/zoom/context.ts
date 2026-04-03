/**
 * Zoom context resolver — loads credentials from ConnectedProvider table.
 */

import { createLogger } from '@/lib/utils';
import { db } from '@/lib/db';
import type { ZoomContext, ZoomCredentials, ZoomConfig } from './types';

const log = createLogger('zoom:context');

export async function resolveZoomContext(tenantId: string): Promise<ZoomContext> {
  const provider = await db.connectedProvider.findFirst({
    where: { tenantId, provider: 'zoom', isActive: true },
  });

  if (!provider) {
    throw new Error(`No active Zoom integration found for tenant ${tenantId}. Ask an admin to connect Zoom in the admin panel.`);
  }

  const credentials = provider.credentials as unknown as ZoomCredentials;
  const config = (provider.config ?? {}) as unknown as ZoomConfig;

  if (!credentials.accountId || !credentials.clientId || !credentials.clientSecret) {
    throw new Error(`Zoom credentials are incomplete for tenant ${tenantId}`);
  }

  if (!config.defaultHostEmail) {
    throw new Error(`Zoom config is missing defaultHostEmail for tenant ${tenantId}`);
  }

  log.info('Resolved Zoom context', { tenantId, providerId: provider.id });

  return { tenantId, credentials, config };
}
