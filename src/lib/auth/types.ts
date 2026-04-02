/**
 * Authentication and authorization type definitions.
 */

/** User roles — mirrors Prisma UserRole enum values */
export type UserRole = 'guest' | 'student' | 'educator' | 'admin';

/** An authenticated user with resolved permissions */
export interface AuthenticatedUser {
  id: string;
  externalId?: string;
  email?: string;
  name?: string;
  role: UserRole;
  scopes: string[];
}

/** Decoded JWT token payload */
export interface TokenPayload {
  /** Subject — the external user ID */
  sub: string;
  role?: UserRole;
  email?: string;
  name?: string;
  /** Issued-at timestamp (epoch seconds) */
  iat?: number;
  /** Expiration timestamp (epoch seconds) */
  exp?: number;
}

/** Result of an authentication attempt */
export type AuthResult =
  | { authenticated: true; user: AuthenticatedUser }
  | { authenticated: false; error: string };
