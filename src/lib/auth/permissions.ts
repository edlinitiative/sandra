/**
 * Role-based permission engine.
 *
 * Each role has a fixed set of scopes. Tools declare required scopes,
 * and the executor checks them before invocation.
 */
import type { UserRole } from './types';

/**
 * Scope definitions by role.
 * Higher roles include all lower role scopes plus additional ones.
 */
const ROLE_SCOPES: Record<UserRole, string[]> = {
  guest: [
    'knowledge:read',
    'repos:read',
  ],
  student: [
    'knowledge:read',
    'repos:read',
    'profile:read',
    'enrollments:read',
    'certificates:read',
    'applications:read',
    'applications:write',
    'actions:submit',
  ],
  educator: [
    'knowledge:read',
    'repos:read',
    'profile:read',
    'enrollments:read',
    'enrollments:write',
    'certificates:read',
    'applications:read',
    'applications:write',
    'actions:submit',
  ],
  admin: [
    'knowledge:read',
    'repos:read',
    'profile:read',
    'enrollments:read',
    'enrollments:write',
    'certificates:read',
    'certificates:write',
    'applications:read',
    'applications:write',
    'admin:read',
    'admin:write',
    'admin:tools',
    'audit:read',
    'actions:submit',
    'actions:approve',
  ],
};

/** Get all scopes granted to a role. */
export function getScopesForRole(role: UserRole): string[] {
  return ROLE_SCOPES[role] ?? ROLE_SCOPES.guest;
}

/** Check if a set of user scopes satisfies all required scopes. */
export function hasRequiredScopes(
  userScopes: string[],
  requiredScopes: string[],
): boolean {
  return requiredScopes.every((scope) => userScopes.includes(scope));
}

/** Check if a role includes a specific scope. */
export function roleHasScope(role: UserRole, scope: string): boolean {
  return getScopesForRole(role).includes(scope);
}

/** Role hierarchy from lowest to highest privilege. */
export function getRoleHierarchy(): UserRole[] {
  return ['guest', 'student', 'educator', 'admin'];
}

/** Check if roleA has equal or higher privilege than roleB. */
export function isRoleAtLeast(roleA: UserRole, roleB: UserRole): boolean {
  const hierarchy = getRoleHierarchy();
  return hierarchy.indexOf(roleA) >= hierarchy.indexOf(roleB);
}

/** Scopes that indicate private/user-data access (used for audit decisions). */
export const PRIVATE_SCOPES = [
  'profile:read',
  'enrollments:read',
  'enrollments:write',
  'certificates:read',
  'certificates:write',
  'applications:read',
  'applications:write',
  'admin:tools',
  'actions:submit',
  'actions:approve',
] as const;

/** Check if a tool's required scopes indicate it accesses private user data. */
export function isPrivateToolScopes(requiredScopes: string[]): boolean {
  return requiredScopes.some((s) =>
    (PRIVATE_SCOPES as readonly string[]).includes(s),
  );
}
