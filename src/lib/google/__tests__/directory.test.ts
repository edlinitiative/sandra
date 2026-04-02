/**
 * Tests for Google Directory service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listUsers, getUserByEmail } from '../directory';
import type { GoogleWorkspaceContext } from '../types';

vi.mock('../auth', () => ({
  getContextToken: vi.fn().mockResolvedValue('ya29.mock-token'),
  GOOGLE_SCOPES: {
    DIRECTORY_READONLY: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockCtx: GoogleWorkspaceContext = {
  tenantId: 'tenant-1',
  providerId: 'provider-1',
  credentials: {
    type: 'service_account',
    client_email: 'test@test.iam.gserviceaccount.com',
    private_key: 'fake-key',
  },
  config: { domain: 'test.org', adminEmail: 'admin@test.org' },
};

describe('Google Directory — listUsers', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('lists users in the workspace domain', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: [
          {
            id: 'u1',
            primaryEmail: 'alice@test.org',
            name: { givenName: 'Alice', familyName: 'Smith' },
            isAdmin: false,
            suspended: false,
          },
          {
            id: 'u2',
            primaryEmail: 'bob@test.org',
            name: { givenName: 'Bob', familyName: 'Jones' },
            isAdmin: true,
            suspended: false,
          },
        ],
      }),
    });

    const result = await listUsers(mockCtx);
    expect(result.users).toHaveLength(2);
    expect(result.users[0]!.email).toBe('alice@test.org');
    expect(result.users[0]!.name).toBe('Alice Smith');
    expect(result.users[1]!.isAdmin).toBe(true);
  });

  it('handles empty domain', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: undefined }),
    });

    const result = await listUsers(mockCtx);
    expect(result.users).toHaveLength(0);
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    await expect(listUsers(mockCtx)).rejects.toThrow('Directory API failed: 403');
  });
});

describe('Google Directory — getUserByEmail', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns a user by email', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'u1',
        primaryEmail: 'alice@test.org',
        name: { givenName: 'Alice', familyName: 'Smith' },
        isAdmin: false,
        suspended: false,
      }),
    });

    const user = await getUserByEmail(mockCtx, 'alice@test.org');
    expect(user).not.toBeNull();
    expect(user!.email).toBe('alice@test.org');
    expect(user!.name).toBe('Alice Smith');
  });

  it('returns null for non-existent user', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const user = await getUserByEmail(mockCtx, 'nobody@test.org');
    expect(user).toBeNull();
  });
});
