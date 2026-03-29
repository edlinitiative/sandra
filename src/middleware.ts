import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── Rate Limiter (in-memory token bucket per IP) ──────────────────────────────

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

/** Max requests per window */
const RATE_LIMIT_MAX = 60;

/** Window duration in milliseconds */
const RATE_LIMIT_WINDOW_MS = 60_000;

/** Refill rate: tokens per millisecond */
const REFILL_RATE = RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS;

/** Cleanup stale buckets every 5 minutes */
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();

  // Periodic cleanup of stale buckets
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.lastRefill > RATE_LIMIT_WINDOW_MS * 2) {
        buckets.delete(key);
      }
    }
  }

  let bucket = buckets.get(ip);
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_MAX, lastRefill: now };
    buckets.set(ip, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(RATE_LIMIT_MAX, bucket.tokens + elapsed * REFILL_RATE);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetMs: Math.ceil((1 - (bucket.tokens % 1)) / REFILL_RATE),
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetMs: Math.ceil((1 - bucket.tokens) / REFILL_RATE),
  };
}

// ── CORS Configuration ────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'https://sandra.edlight.org',
  'https://edlight.org',
]);

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const isAllowed =
    ALLOWED_ORIGINS.has(origin) ||
    origin.endsWith('.edlight.org') ||
    process.env.NODE_ENV === 'development';

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// ── Middleware ─────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets and internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  // Rate limiting (API routes only)
  if (pathname.startsWith('/api/')) {
    // Exempt health endpoint from rate limiting
    if (pathname === '/api/health') {
      const response = NextResponse.next();
      for (const [key, value] of Object.entries(getCorsHeaders(request))) {
        if (value) response.headers.set(key, value);
      }
      return response;
    }

    const ip = getClientIp(request);
    const { allowed, remaining, resetMs } = checkRateLimit(ip);

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(resetMs / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
            ...getCorsHeaders(request),
          },
        },
      );
    }

    const response = NextResponse.next();

    // Rate limit headers
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
    response.headers.set('X-RateLimit-Remaining', String(remaining));

    // CORS headers
    for (const [key, value] of Object.entries(getCorsHeaders(request))) {
      if (value) response.headers.set(key, value);
    }

    return response;
  }

  // Non-API routes: just add CORS headers
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(getCorsHeaders(request))) {
    if (value) response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: [
    // Match API routes and pages, skip static assets
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
