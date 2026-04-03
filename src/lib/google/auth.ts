/**
 * Google Workspace — Service Account Authentication.
 *
 * Uses JWT-based auth (RFC 7523) for domain-wide delegation.
 * The service account impersonates users in the Workspace domain,
 * allowing Drive, Gmail, and Directory access on their behalf.
 *
 * No dependency on googleapis SDK — uses raw JWT + fetch for minimal footprint.
 */

import { createLogger } from '@/lib/utils';
import type {
  GoogleServiceAccountCredentials,
  GoogleAccessToken,
  GoogleWorkspaceContext,
} from './types';

const log = createLogger('google:auth');

// ─── JWT Helpers ─────────────────────────────────────────────────────────────

/** Base64url-encode a buffer or string (no padding). */
function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

/** Build a signed JWT for Google OAuth2 token exchange. */
async function buildSignedJwt(
  credentials: GoogleServiceAccountCredentials,
  scopes: string[],
  impersonateEmail?: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };

  const payload: Record<string, unknown> = {
    iss: credentials.client_email,
    scope: scopes.join(' '),
    aud: credentials.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour
  };

  if (impersonateEmail) {
    payload.sub = impersonateEmail; // domain-wide delegation
  }

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  // Import private key and sign
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(credentials.private_key);

  return `${unsigned}.${base64url(signature)}`;
}

// ─── Token Cache ─────────────────────────────────────────────────────────────

/**
 * In-memory token cache keyed by `${clientEmail}:${impersonateEmail}:${scopeHash}`.
 * Tokens are refreshed 5 minutes before expiry.
 */
const tokenCache = new Map<string, GoogleAccessToken>();
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

function cacheKey(clientEmail: string, impersonate: string, scopes: string[]): string {
  return `${clientEmail}:${impersonate}:${scopes.sort().join(',')}`;
}

function getCachedToken(key: string): GoogleAccessToken | undefined {
  const token = tokenCache.get(key);
  if (!token) return undefined;
  const expiresAt = token.obtained_at + token.expires_in * 1000;
  if (Date.now() > expiresAt - REFRESH_BUFFER_MS) {
    tokenCache.delete(key);
    return undefined;
  }
  return token;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Google API scope constants. */
export const GOOGLE_SCOPES = {
  DRIVE_READONLY: 'https://www.googleapis.com/auth/drive.readonly',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
  GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
  GMAIL_COMPOSE: 'https://www.googleapis.com/auth/gmail.compose',
  GMAIL_READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
  DIRECTORY_READONLY: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
  DIRECTORY_GROUP_READONLY: 'https://www.googleapis.com/auth/admin.directory.group.readonly',
  CALENDAR: 'https://www.googleapis.com/auth/calendar',
  CALENDAR_EVENTS: 'https://www.googleapis.com/auth/calendar.events',
} as const;

/**
 * Obtain an access token for Google APIs using service account JWT flow.
 *
 * @param credentials  - Service account credentials (client_email + private_key)
 * @param scopes       - OAuth2 scopes to request
 * @param impersonateEmail - (Optional) domain user to impersonate via domain-wide delegation
 */
export async function getAccessToken(
  credentials: GoogleServiceAccountCredentials,
  scopes: string[],
  impersonateEmail?: string,
): Promise<string> {
  const key = cacheKey(credentials.client_email, impersonateEmail ?? '', scopes);

  const cached = getCachedToken(key);
  if (cached) return cached.access_token;

  log.info('Requesting new access token', {
    clientEmail: credentials.client_email,
    impersonate: impersonateEmail ?? '(none)',
    scopes: scopes.length,
  });

  const jwt = await buildSignedJwt(credentials, scopes, impersonateEmail);
  const tokenUri = credentials.token_uri ?? 'https://oauth2.googleapis.com/token';

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    log.error('Token exchange failed', { status: res.status, body });
    throw new Error(`Google OAuth token exchange failed: ${res.status} — ${body}`);
  }

  const data = (await res.json()) as { access_token: string; token_type: string; expires_in: number };

  const token: GoogleAccessToken = {
    ...data,
    obtained_at: Date.now(),
  };

  tokenCache.set(key, token);
  log.info('Access token obtained', { expiresIn: data.expires_in });

  return token.access_token;
}

/**
 * Get an access token from a GoogleWorkspaceContext.
 * Convenience wrapper that pulls credentials + impersonation from context.
 */
export async function getContextToken(
  ctx: GoogleWorkspaceContext,
  scopes: string[],
): Promise<string> {
  return getAccessToken(
    ctx.credentials,
    scopes,
    ctx.impersonateEmail ?? ctx.config.adminEmail,
  );
}

/**
 * Validate that service account credentials are functional.
 * Attempts a token exchange with minimal scopes.
 */
export async function validateCredentials(
  credentials: GoogleServiceAccountCredentials,
  impersonateEmail?: string,
): Promise<{ valid: boolean; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    await getAccessToken(
      credentials,
      ['https://www.googleapis.com/auth/drive.metadata.readonly'],
      impersonateEmail,
    );
    return { valid: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - start,
    };
  }
}

/** Clear all cached tokens (useful for testing or credential rotation). */
export function clearTokenCache(): void {
  tokenCache.clear();
}
