/**
 * Tenant context helpers.
 *
 * Provides utilities for extracting and requiring tenant context
 * from authenticated requests.
 */
import type { AuthResult, AuthenticatedUser } from './types';

/** Header name used by the Next.js middleware to pass the resolved tenant ID downstream. */
export const RESOLVED_TENANT_HEADER = 'x-resolved-tenant-id';

/**
 * Read the tenant ID that the edge middleware resolved and forwarded
 * via the `x-resolved-tenant-id` request header.
 *
 * Returns `null` when no tenant could be determined (e.g. single-tenant
 * mode or a public route that skipped resolution).
 */
export function getTenantFromHeaders(headers: Headers): string | null {
  return headers.get(RESOLVED_TENANT_HEADER) ?? null;
}

/**
 * Require both authentication and a tenant context.
 *
 * Throws if the request is unauthenticated or if no tenant context
 * was resolved (via middleware header, JWT lookup, or API key).
 */
export function requireTenantContext(
  auth: AuthResult,
): { tenantId: string; user: AuthenticatedUser } {
  if (!auth.authenticated) {
    throw new Error('Not authenticated');
  }
  if (!auth.user.tenantId) {
    throw new Error('No tenant context');
  }
  return { tenantId: auth.user.tenantId, user: auth.user };
}
