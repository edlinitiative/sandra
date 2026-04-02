/**
 * Request-level authentication middleware.
 *
 * Extracts and verifies user identity from the request, resolving
 * the canonical user record and their permissions.
 *
 * Supports:
 * - `Authorization: Bearer <jwt>` — JWT token verification
 * - `x-user-id` header (development only) — direct external ID
 * - Anonymous fallback — guest scopes
 */
import type { AuthResult, AuthenticatedUser, UserRole } from './types';
import { verifyToken } from './token-verifier';
import { getScopesForRole } from './permissions';
import { db } from '@/lib/db';
import { getUserByExternalId, resolveUserByExternalId } from '@/lib/db/users';
import { createLogger } from '@/lib/utils';

const log = createLogger('auth:middleware');

/**
 * Authenticate an incoming request.
 *
 * Returns an AuthResult indicating whether the user is authenticated
 * and their resolved identity + scopes.
 */
export async function authenticateRequest(
  request: Request,
): Promise<AuthResult> {
  // 1. Try Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    if (!payload) {
      return { authenticated: false, error: 'Invalid or expired token' };
    }

    try {
      const user = await resolveUserByExternalId(db, {
        externalId: payload.sub,
        email: payload.email ?? undefined,
        name: payload.name ?? undefined,
      });

      const role = (user.role as UserRole) ?? payload.role ?? 'student';
      const scopes = getScopesForRole(role);

      log.info('Authenticated via Bearer token', {
        userId: user.id,
        externalId: payload.sub,
        role,
      });

      return {
        authenticated: true,
        user: {
          id: user.id,
          externalId: payload.sub,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          role,
          scopes,
        },
      };
    } catch (error) {
      log.warn('Failed to resolve user from token', {
        sub: payload.sub,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return { authenticated: false, error: 'Failed to resolve user' };
    }
  }

  // 2. Development: x-user-id header
  if (process.env.NODE_ENV !== 'production') {
    const devUserId = request.headers.get('x-user-id');
    if (devUserId) {
      try {
        const user = await getUserByExternalId(db, devUserId);
        if (user) {
          const role = (user.role as UserRole) ?? 'student';
          return {
            authenticated: true,
            user: {
              id: user.id,
              externalId: devUserId,
              email: user.email ?? undefined,
              name: user.name ?? undefined,
              role,
              scopes: getScopesForRole(role),
            },
          };
        }
      } catch {
        // Fall through to anonymous
      }
    }
  }

  // 3. Anonymous / guest
  return { authenticated: false, error: 'No authentication provided' };
}

/**
 * Require authentication. Returns the user or throws.
 */
export async function requireAuth(
  request: Request,
): Promise<AuthenticatedUser> {
  const result = await authenticateRequest(request);
  if (!result.authenticated) {
    throw new Error(result.error);
  }
  return result.user;
}
