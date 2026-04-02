/**
 * Tests for Google Workspace authentication module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAccessToken, validateCredentials, clearTokenCache, GOOGLE_SCOPES } from '../auth';
import type { GoogleServiceAccountCredentials } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock crypto.createSign to avoid needing a real RSA private key
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    createSign: () => ({
      update: vi.fn(),
      sign: () => Buffer.from('fake-signature'),
    }),
  };
});

const testCredentials: GoogleServiceAccountCredentials = {
  type: 'service_account',
  client_email: 'test@test-project.iam.gserviceaccount.com',
  private_key: 'fake-private-key-for-testing',
  project_id: 'test-project',
};

describe('Google Auth — GOOGLE_SCOPES', () => {
  it('exposes all required scope constants', () => {
    expect(GOOGLE_SCOPES.DRIVE_READONLY).toBe('https://www.googleapis.com/auth/drive.readonly');
    expect(GOOGLE_SCOPES.GMAIL_SEND).toBe('https://www.googleapis.com/auth/gmail.send');
    expect(GOOGLE_SCOPES.GMAIL_COMPOSE).toBe('https://www.googleapis.com/auth/gmail.compose');
    expect(GOOGLE_SCOPES.DIRECTORY_READONLY).toBe('https://www.googleapis.com/auth/admin.directory.user.readonly');
  });
});

describe('Google Auth — getAccessToken', () => {
  beforeEach(() => {
    clearTokenCache();
    mockFetch.mockReset();
  });

  afterEach(() => {
    clearTokenCache();
  });

  it('fetches a new token from Google OAuth2', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'ya29.test-token', token_type: 'Bearer', expires_in: 3600 }),
    });

    const token = await getAccessToken(testCredentials, [GOOGLE_SCOPES.DRIVE_READONLY]);
    expect(token).toBe('ya29.test-token');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify the request
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(opts.method).toBe('POST');
  });

  it('caches tokens and reuses them', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'ya29.cached', token_type: 'Bearer', expires_in: 3600 }),
    });

    const token1 = await getAccessToken(testCredentials, [GOOGLE_SCOPES.DRIVE_READONLY]);
    const token2 = await getAccessToken(testCredentials, [GOOGLE_SCOPES.DRIVE_READONLY]);

    expect(token1).toBe('ya29.cached');
    expect(token2).toBe('ya29.cached');
    expect(mockFetch).toHaveBeenCalledTimes(1); // only 1 call
  });

  it('uses different cache keys for different scopes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-drive', token_type: 'Bearer', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-gmail', token_type: 'Bearer', expires_in: 3600 }),
      });

    const t1 = await getAccessToken(testCredentials, [GOOGLE_SCOPES.DRIVE_READONLY]);
    const t2 = await getAccessToken(testCredentials, [GOOGLE_SCOPES.GMAIL_SEND]);

    expect(t1).toBe('token-drive');
    expect(t2).toBe('token-gmail');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on failed token exchange', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => '{"error":"invalid_grant"}',
    });

    await expect(
      getAccessToken(testCredentials, [GOOGLE_SCOPES.DRIVE_READONLY]),
    ).rejects.toThrow('Google OAuth token exchange failed: 401');
  });
});

describe('Google Auth — validateCredentials', () => {
  beforeEach(() => {
    clearTokenCache();
    mockFetch.mockReset();
  });

  it('returns valid: true on successful token exchange', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'valid', token_type: 'Bearer', expires_in: 3600 }),
    });

    const result = await validateCredentials(testCredentials);
    expect(result.valid).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns valid: false with error on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    const result = await validateCredentials(testCredentials);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('403');
  });
});
