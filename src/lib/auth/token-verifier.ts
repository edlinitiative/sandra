/**
 * JWT token verification using HS256 (HMAC-SHA256).
 *
 * - In development, also accepts `dev:<userId>` shorthand for testing.
 * - In production, requires JWT_SECRET environment variable.
 */
import { createHmac } from 'crypto';
import type { TokenPayload } from './types';
import { createLogger } from '@/lib/utils';

const log = createLogger('auth:token');

/**
 * Verify and decode a JWT token.
 *
 * Supports:
 * - `dev:<userId>` — development-only shorthand (returns student role)
 * - Standard HS256 JWT — verified against JWT_SECRET
 *
 * Returns null if verification fails.
 */
export function verifyToken(token: string): TokenPayload | null {
  // Development shortcut: dev:<userId>
  if (process.env.NODE_ENV !== 'production' && token.startsWith('dev:')) {
    const userId = token.slice(4);
    if (userId) {
      log.debug('Dev token accepted', { sub: userId });
      return { sub: userId, role: 'student' };
    }
    return null;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    log.warn('JWT_SECRET not configured, cannot verify token');
    return null;
  }

  try {
    return verifyHS256(token, secret);
  } catch (error) {
    log.debug('Token verification failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

/**
 * Verify an HS256 JWT and return the decoded payload.
 */
function verifyHS256(token: string, secret: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  // Verify signature
  const data = `${headerB64}.${payloadB64}`;
  const expectedSig = createHmac('sha256', secret)
    .update(data)
    .digest('base64url');

  if (expectedSig !== signatureB64) {
    return null;
  }

  // Decode and validate header
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString()) as {
    alg?: string;
  };
  if (header.alg !== 'HS256') {
    return null;
  }

  // Decode payload
  const payload = JSON.parse(
    Buffer.from(payloadB64, 'base64url').toString(),
  ) as TokenPayload;

  // Check expiration
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    log.debug('Token expired');
    return null;
  }

  if (!payload.sub) {
    return null;
  }

  return payload;
}

/**
 * Create a signed HS256 JWT token.
 * Primarily for testing and development tooling.
 */
export function createToken(payload: TokenPayload, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}
