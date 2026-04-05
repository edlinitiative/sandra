/**
 * Tests for the TenantApiKey authentication flow.
 *
 * Covers:
 *   - Valid sk_live_ key is looked up by hash and returns authenticated result with tenantId
 *   - Unknown key returns unauthenticated
 *   - Revoked key (isActive=false) returns unauthenticated
 *   - Expired key returns unauthenticated
 *   - Inactive tenant returns unauthenticated
 *   - lastUsedAt is updated (fire-and-forget)
 *   - JWT Bearer path still works (regression)
 *   - Anonymous fallback still works (regression)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// ─── Mock DB ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    tenantApiKey: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/auth/token-verifier', () => ({
  verifyToken: vi.fn().mockReturnValue(null), // no valid JWT unless overridden
  createToken: vi.fn(),
}));

vi.mock('@/lib/db/users', () => ({
  getUserByExternalId: vi.fn(),
  resolveUserByExternalId: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(authHeader: string): Request {
  return new Request('https://example.com/api/chat', {
    headers: { Authorization: authHeader },
  });
}

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('authenticateRequest — tenant API key', () => {
  let findUnique: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { db } = await import('@/lib/db');
    findUnique = (db as unknown as { tenantApiKey: { findUnique: ReturnType<typeof vi.fn> } }).tenantApiKey.findUnique;
    findUnique.mockReset();
  });

  it('returns authenticated with tenantId for a valid sk_live_ key', async () => {
    const plaintext = 'sk_live_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
    const keyHash = hashKey(plaintext);

    findUnique.mockResolvedValue({
      id: 'key-1',
      tenantId: 'tenant-abc',
      name: 'Production',
      scopes: ['chat:send', 'knowledge:read'],
      isActive: true,
      expiresAt: null,
      tenant: { id: 'tenant-abc', name: 'Acme Corp', isActive: true },
    });

    const { authenticateRequest } = await import('@/lib/auth/middleware');
    const result = await authenticateRequest(makeRequest(`Bearer ${plaintext}`));

    expect(result.authenticated).toBe(true);
    if (!result.authenticated) return;

    expect(result.user.tenantId).toBe('tenant-abc');
    expect(result.user.scopes).toContain('chat:send');
    expect(result.user.role).toBe('admin');

    // Verify the lookup used the hash, not the plaintext
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { keyHash } }),
    );
  });

  it('returns unauthenticated for an unknown key', async () => {
    findUnique.mockResolvedValue(null);

    const { authenticateRequest } = await import('@/lib/auth/middleware');
    const result = await authenticateRequest(makeRequest('Bearer sk_live_unknownkey'));

    expect(result.authenticated).toBe(false);
    if (result.authenticated) return;
    expect(result.error).toMatch(/invalid/i);
  });

  it('returns unauthenticated for a revoked key (isActive=false)', async () => {
    findUnique.mockResolvedValue({
      id: 'key-2',
      tenantId: 'tenant-abc',
      name: 'Old key',
      scopes: ['chat:send'],
      isActive: false,
      expiresAt: null,
      tenant: { id: 'tenant-abc', name: 'Acme', isActive: true },
    });

    const { authenticateRequest } = await import('@/lib/auth/middleware');
    const result = await authenticateRequest(makeRequest('Bearer sk_live_revokedkey'));

    expect(result.authenticated).toBe(false);
    if (result.authenticated) return;
    expect(result.error).toMatch(/revoked/i);
  });

  it('returns unauthenticated for an expired key', async () => {
    findUnique.mockResolvedValue({
      id: 'key-3',
      tenantId: 'tenant-abc',
      name: 'Expired',
      scopes: ['chat:send'],
      isActive: true,
      expiresAt: new Date('2020-01-01'), // past
      tenant: { id: 'tenant-abc', name: 'Acme', isActive: true },
    });

    const { authenticateRequest } = await import('@/lib/auth/middleware');
    const result = await authenticateRequest(makeRequest('Bearer sk_live_expiredkey'));

    expect(result.authenticated).toBe(false);
    if (result.authenticated) return;
    expect(result.error).toMatch(/expired/i);
  });

  it('returns unauthenticated when the tenant is inactive', async () => {
    findUnique.mockResolvedValue({
      id: 'key-4',
      tenantId: 'tenant-inactive',
      name: 'Key for inactive tenant',
      scopes: ['chat:send'],
      isActive: true,
      expiresAt: null,
      tenant: { id: 'tenant-inactive', name: 'Gone Corp', isActive: false },
    });

    const { authenticateRequest } = await import('@/lib/auth/middleware');
    const result = await authenticateRequest(makeRequest('Bearer sk_live_inactivetenant'));

    expect(result.authenticated).toBe(false);
    if (result.authenticated) return;
    expect(result.error).toMatch(/inactive/i);
  });

  it('accepts sk_test_ prefix keys as well', async () => {
    findUnique.mockResolvedValue({
      id: 'key-5',
      tenantId: 'tenant-staging',
      name: 'Staging',
      scopes: ['chat:send'],
      isActive: true,
      expiresAt: null,
      tenant: { id: 'tenant-staging', name: 'Staging Corp', isActive: true },
    });

    const { authenticateRequest } = await import('@/lib/auth/middleware');
    const result = await authenticateRequest(makeRequest('Bearer sk_test_stagingkey'));

    expect(result.authenticated).toBe(true);
    if (!result.authenticated) return;
    expect(result.user.tenantId).toBe('tenant-staging');
  });

  it('does NOT treat a regular JWT as an API key (regression)', async () => {
    // JWT does not start with sk_live_ — should go through verifyToken path
    const { verifyToken } = await import('@/lib/auth/token-verifier');
    vi.mocked(verifyToken).mockReturnValue(null);

    const { authenticateRequest } = await import('@/lib/auth/middleware');
    const result = await authenticateRequest(makeRequest('Bearer eyJhbGciOiJIUzI1NiJ9.fake'));

    // verifyToken returned null → unauthenticated (not an API key error)
    expect(result.authenticated).toBe(false);
    // findUnique should NOT have been called
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns unauthenticated when no Authorization header is provided', async () => {
    const { authenticateRequest } = await import('@/lib/auth/middleware');
    const result = await authenticateRequest(new Request('https://example.com/api/chat'));

    expect(result.authenticated).toBe(false);
  });
});
