/**
 * Admin API key authentication middleware.
 * Used to protect admin-only endpoints.
 */
import { timingSafeEqual } from 'crypto';
import { AuthError, ConfigurationError } from './errors';
import { env } from '@/lib/config';
import type { AuthResult } from '@/lib/auth/types';

/**
 * Verify that the caller has admin privileges.
 *
 * Resolution order:
 * 1. **Authenticated user role** — if `auth` is provided and the user has
 *    `role === 'admin'`, access is granted immediately.
 * 2. **Tenant API-key scope** — if `auth` is provided and the key's scopes
 *    include `'admin'`, access is granted.
 * 3. **Global ADMIN_API_KEY fallback** — reads the `x-api-key` header and
 *    performs a timing-safe comparison against the `ADMIN_API_KEY` env var.
 *    This path provides backward compatibility and acts as a superadmin key.
 *
 * Throws:
 * - ConfigurationError (503-like) if ADMIN_API_KEY is not configured and no
 *   auth context grants admin access
 * - AuthError (401) if the key is missing or invalid and no auth context
 *   grants admin access
 */
export function requireAdminAuth(request: Request, auth?: AuthResult): void {
  // Primary: check authenticated context for admin privileges
  if (auth?.authenticated) {
    if (auth.user.role === 'admin') {
      return; // Admin role from JWT/session — allowed
    }
    if (auth.user.scopes?.includes('admin')) {
      return; // Tenant API key with admin scope — allowed
    }
  }

  // Fallback: check global ADMIN_API_KEY (backward compat / superadmin)
  const expectedKey = env.ADMIN_API_KEY;

  if (!expectedKey) {
    throw new ConfigurationError('Admin endpoints are not configured');
  }

  const providedKey = request.headers.get('x-api-key');

  if (!providedKey) {
    throw new AuthError('Invalid or missing API key');
  }

  // Timing-safe comparison to prevent timing attacks
  let match: boolean;
  try {
    const expectedBuf = Buffer.from(expectedKey);
    const providedBuf = Buffer.from(providedKey);
    if (expectedBuf.length !== providedBuf.length) {
      match = false;
    } else {
      match = timingSafeEqual(expectedBuf, providedBuf);
    }
  } catch {
    match = false;
  }

  if (!match) {
    throw new AuthError('Invalid or missing API key');
  }
}
