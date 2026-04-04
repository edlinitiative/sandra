/**
 * Google Workspace — Tenant context resolver.
 *
 * Resolves the GoogleWorkspaceContext for a given user/tenant,
 * loading credentials from the ConnectedProvider table.
 */

import { createLogger } from '@/lib/utils';
import { db } from '@/lib/db';
import type { GoogleWorkspaceContext, GoogleServiceAccountCredentials, GoogleWorkspaceConfig } from './types';

const log = createLogger('google:context');

/**
 * Resolve the GoogleWorkspaceContext for a tenant.
 *
 * @param tenantId - The tenant ID
 * @param impersonateEmail - (Optional) specific user to impersonate; defaults to admin
 */
export async function resolveGoogleContext(
  tenantId: string,
  impersonateEmail?: string,
): Promise<GoogleWorkspaceContext> {
  const provider = await db.connectedProvider.findFirst({
    where: {
      tenantId,
      provider: 'google_workspace',
      isActive: true,
    },
  });

  if (!provider) {
    throw new Error(`No active Google Workspace provider found for tenant ${tenantId}`);
  }

  const credentials = provider.credentials as unknown as GoogleServiceAccountCredentials;
  const config = (provider.config ?? {}) as unknown as GoogleWorkspaceConfig;

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(`Invalid Google service account credentials for tenant ${tenantId}`);
  }

  if (!config.domain || !config.adminEmail) {
    throw new Error(`Google Workspace config missing domain or adminEmail for tenant ${tenantId}`);
  }

  log.info('Resolved Google context', { tenantId, providerId: provider.id, domain: config.domain });

  return {
    tenantId,
    providerId: provider.id,
    credentials,
    config,
    impersonateEmail: impersonateEmail ?? config.adminEmail,
  };
}

/**
 * Resolve tenant ID for a user.
 * Returns the first active tenant membership, or null if the user has no tenant.
 */
export async function resolveTenantForUser(userId: string): Promise<string | null> {
  const membership = await db.tenantMember.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { tenantId: true },
  });

  return membership?.tenantId ?? null;
}

/**
 * Get the user's role within a tenant.
 */
export async function getTenantRole(
  tenantId: string,
  userId: string,
): Promise<'basic' | 'manager' | 'admin' | null> {
  const membership = await db.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { role: true, isActive: true },
  });

  if (!membership || !membership.isActive) return null;
  return membership.role;
}
