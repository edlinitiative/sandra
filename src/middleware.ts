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

// ── Tenant Resolution ─────────────────────────────────────────────────────────

/** Routes that skip tenant resolution entirely. */
const TENANT_SKIP_PATTERNS: RegExp[] = [
  /^\/api\/health$/,
  /^\/api\/webhooks(\/|$)/,
  /^\/api\/auth(\/|$)/,
  /^\/login/,
  /^\/api\/cron(\/|$)/,
];

/** Header written by this middleware so downstream code can read the tenant. */
const RESOLVED_TENANT_HEADER = 'x-resolved-tenant-id';

/**
 * Extract a tenant slug from the hostname.
 * E.g. `acme.app.example.com` → `acme`
 *      `app.example.com`      → null (no sub-tenant)
 *      `localhost:3000`        → null
 */
function extractTenantSlug(hostname: string): string | null {
  // Strip port
  const host = hostname.split(':')[0] ?? '';

  // localhost / IP — no subdomain extraction
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }

  const parts = host.split('.');

  // Need at least 4 parts for a sub-tenant: <slug>.<app>.<domain>.<tld>
  // e.g. acme.app.example.com → ["acme", "app", "example", "com"]
  if (parts.length >= 4) {
    return parts[0] ?? null;
  }

  return null;
}

/**
 * Resolve the tenant for this request.
 * Returns the tenant ID (from explicit header) or a slug (from subdomain)
 * that downstream code can use to look up the tenant.
 */
function resolveTenantIdentifier(request: NextRequest): string | null {
  // 1. Explicit header takes priority
  const explicitTenantId = request.headers.get('x-tenant-id');
  if (explicitTenantId) {
    return explicitTenantId;
  }

  // 2. Subdomain extraction
  const hostname = request.headers.get('host') ?? request.nextUrl.hostname;
  const slug = extractTenantSlug(hostname);
  if (slug) {
    return slug;
  }

  return null;
}

/**
 * Stamp the resolved tenant identifier onto the response so downstream
 * route handlers / auth middleware can read it from the request headers.
 */
function applyTenantHeader(response: NextResponse, request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Skip tenant resolution for public / system routes
  if (TENANT_SKIP_PATTERNS.some((re) => re.test(pathname))) {
    return response;
  }

  const tenantIdentifier = resolveTenantIdentifier(request);
  if (tenantIdentifier) {
    // Set on the *request* headers that Next.js forwards to the route handler
    response.headers.set(RESOLVED_TENANT_HEADER, tenantIdentifier);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(RESOLVED_TENANT_HEADER, tenantIdentifier);
    // Rewrite with the updated request headers so server components / route
    // handlers see the header via `headers()` or `request.headers`.
    return NextResponse.next({
      request: { headers: requestHeaders },
      headers: response.headers,
    });
  }

  return response;
}

// ── CORS Configuration ────────────────────────────────────────────────────────

/** 
 * CORS allowed origins. 
 * Set ALLOWED_ORIGINS env var as a comma-separated list for production.
 * Falls back to localhost-only in development.
 */
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
);

/** Optional wildcard suffix for CORS (e.g. ".mycompany.com" allows all subdomains). */
const ALLOWED_ORIGIN_SUFFIX = process.env.ALLOWED_ORIGIN_SUFFIX ?? '';

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const isAllowed =
    ALLOWED_ORIGINS.has(origin) ||
    (ALLOWED_ORIGIN_SUFFIX && origin.endsWith(ALLOWED_ORIGIN_SUFFIX)) ||
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
      return applyTenantHeader(response, request);
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

    return applyTenantHeader(response, request);
  }

  // Non-API routes: just add CORS headers
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(getCorsHeaders(request))) {
    if (value) response.headers.set(key, value);
  }
  return applyTenantHeader(response, request);
}

export const config = {
  matcher: [
    // Match API routes and pages, skip static assets
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
