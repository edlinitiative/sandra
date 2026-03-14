/**
 * Admin API key authentication middleware.
 * Used to protect admin-only endpoints.
 */
import { timingSafeEqual } from 'crypto';
import { AuthError, ConfigurationError } from './errors';
import { env } from '@/lib/config';

/**
 * Validate the API key from an incoming request.
 * Reads the key from the `x-api-key` header and compares it with ADMIN_API_KEY
 * using a timing-safe comparison to prevent timing attacks.
 *
 * Throws:
 * - ConfigurationError (503-like) if ADMIN_API_KEY is not configured
 * - AuthError (401) if the key is missing or invalid
 */
export function requireAdminAuth(request: Request): void {
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
