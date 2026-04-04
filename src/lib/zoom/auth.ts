/**
 * Zoom Server-to-Server OAuth token fetching.
 *
 * Tokens expire after 1 hour. We cache them in-process with expiry.
 * Each tenant gets its own token cache keyed by tenantId.
 */

import { createLogger } from '@/lib/utils';
import type { ZoomCredentials } from './types';

const log = createLogger('zoom:auth');

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

// In-process token cache — one entry per tenantId
const tokenCache = new Map<string, CachedToken>();

/**
 * Fetch (or return cached) a Zoom Server-to-Server OAuth access token.
 */
export async function getZoomToken(
  tenantId: string,
  credentials: ZoomCredentials,
): Promise<string> {
  const cached = tokenCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  log.info('Fetching new Zoom token', { tenantId });

  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');

  const res = await fetch(
    `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(credentials.accountId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    log.error('Zoom token fetch failed', { status: res.status, body });
    throw new Error(`Zoom OAuth failed: ${res.status} — ${body}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };

  const token: CachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  tokenCache.set(tenantId, token);

  return token.token;
}
