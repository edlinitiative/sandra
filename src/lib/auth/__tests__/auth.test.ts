/**
 * Tests for the auth module: token verifier, permissions, and middleware.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyToken, createToken } from '../token-verifier';
import {
  getScopesForRole,
  hasRequiredScopes,
  roleHasScope,
  isRoleAtLeast,
  isPrivateToolScopes,
} from '../permissions';

// ── Token Verifier ──────────────────────────────────────────────────────────

describe('verifyToken', () => {
  it('accepts dev:<userId> in non-production', () => {
    // NODE_ENV is 'test' by default in vitest
    const payload = verifyToken('dev:user-123');
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-123');
    expect(payload!.role).toBe('student');
  });

  it('rejects empty dev token', () => {
    // NODE_ENV is 'test' by default
    const payload = verifyToken('dev:');
    expect(payload).toBeNull();
  });

  it('returns null when JWT_SECRET is not set', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    const payload = verifyToken('some.jwt.token');
    expect(payload).toBeNull();

    if (original) process.env.JWT_SECRET = original;
  });

  it('verifies a valid HS256 JWT', () => {
    const secret = 'test-secret-key-12345';
    process.env.JWT_SECRET = secret;

    const token = createToken(
      { sub: 'ext-user-1', role: 'student', email: 'test@edlight.org' },
      secret,
    );

    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('ext-user-1');
    expect(payload!.role).toBe('student');
    expect(payload!.email).toBe('test@edlight.org');

    delete process.env.JWT_SECRET;
  });

  it('rejects a JWT with wrong signature', () => {
    const secret = 'test-secret-key-12345';
    process.env.JWT_SECRET = secret;

    const token = createToken({ sub: 'user-1' }, 'wrong-secret');
    const payload = verifyToken(token);
    expect(payload).toBeNull();

    delete process.env.JWT_SECRET;
  });

  it('rejects an expired JWT', () => {
    const secret = 'test-secret-key-12345';
    process.env.JWT_SECRET = secret;

    const token = createToken(
      { sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 3600 },
      secret,
    );

    const payload = verifyToken(token);
    expect(payload).toBeNull();

    delete process.env.JWT_SECRET;
  });
});

describe('createToken', () => {
  it('creates a valid JWT that can be verified', () => {
    const secret = 'test-secret';
    const token = createToken({ sub: 'user-1', role: 'admin' }, secret);

    expect(token.split('.')).toHaveLength(3);

    process.env.JWT_SECRET = secret;
    const payload = verifyToken(token);
    expect(payload!.sub).toBe('user-1');
    expect(payload!.role).toBe('admin');
    delete process.env.JWT_SECRET;
  });
});

// ── Permissions ─────────────────────────────────────────────────────────────

describe('getScopesForRole', () => {
  it('returns limited scopes for guest', () => {
    const scopes = getScopesForRole('guest');
    expect(scopes).toContain('knowledge:read');
    expect(scopes).toContain('repos:read');
    expect(scopes).not.toContain('profile:read');
  });

  it('returns profile + enrollment scopes for student', () => {
    const scopes = getScopesForRole('student');
    expect(scopes).toContain('knowledge:read');
    expect(scopes).toContain('profile:read');
    expect(scopes).toContain('enrollments:read');
    expect(scopes).toContain('certificates:read');
    expect(scopes).toContain('applications:read');
  });

  it('returns admin scopes for admin', () => {
    const scopes = getScopesForRole('admin');
    expect(scopes).toContain('admin:read');
    expect(scopes).toContain('admin:write');
    expect(scopes).toContain('audit:read');
  });

  it('returns enrollment write for educator', () => {
    const scopes = getScopesForRole('educator');
    expect(scopes).toContain('enrollments:write');
  });
});

describe('hasRequiredScopes', () => {
  it('returns true when all scopes are present', () => {
    expect(
      hasRequiredScopes(['knowledge:read', 'repos:read', 'profile:read'], ['profile:read']),
    ).toBe(true);
  });

  it('returns false when scopes are missing', () => {
    expect(
      hasRequiredScopes(['knowledge:read'], ['profile:read']),
    ).toBe(false);
  });
});

describe('roleHasScope', () => {
  it('guest has knowledge:read', () => {
    expect(roleHasScope('guest', 'knowledge:read')).toBe(true);
  });

  it('guest does not have profile:read', () => {
    expect(roleHasScope('guest', 'profile:read')).toBe(false);
  });

  it('admin has audit:read', () => {
    expect(roleHasScope('admin', 'audit:read')).toBe(true);
  });
});

describe('isRoleAtLeast', () => {
  it('admin is at least student', () => {
    expect(isRoleAtLeast('admin', 'student')).toBe(true);
  });

  it('guest is not at least student', () => {
    expect(isRoleAtLeast('guest', 'student')).toBe(false);
  });

  it('student is at least student', () => {
    expect(isRoleAtLeast('student', 'student')).toBe(true);
  });
});

describe('isPrivateToolScopes', () => {
  it('returns true for profile:read', () => {
    expect(isPrivateToolScopes(['profile:read'])).toBe(true);
  });

  it('returns false for knowledge:read', () => {
    expect(isPrivateToolScopes(['knowledge:read', 'repos:read'])).toBe(false);
  });
});
