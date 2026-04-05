/**
 * POST /api/tools/connections/[connectionId]/test
 *
 * Fires a lightweight GET request to the connection's base URL with its
 * configured auth credentials, measures latency, and persists the health
 * check result back to the database.
 *
 * Response:
 *   { ok, status, latencyMs, message, error? }
 *
 * "ok" is true only for HTTP 2xx/3xx responses.
 * A 4xx still means the server is reachable (possibly auth/path issue).
 * Network errors or timeouts mean the host is unreachable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { applyAuth } from '@/lib/tools/api-tool-executor';
import type { ApiCredentials, AuthConfig } from '@/lib/tools/api-tool-executor';
import { createLogger } from '@/lib/utils';

const log = createLogger('api:tools:connections:test');

interface RouteContext {
  params: Promise<{ connectionId: string }>;
}

export async function POST(
  _request: NextRequest,
  context: RouteContext,
) {
  const { connectionId } = await context.params;

  // ── Load connection ──────────────────────────────────────────────────────
  const connection = await db.externalApiConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  // ── Build headers + URL with auth ────────────────────────────────────────
  const headers: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Sandra/1.0 (health-check)',
  };

  const url = new URL(
    connection.baseUrl.endsWith('/') ? connection.baseUrl : `${connection.baseUrl}/`,
  );

  applyAuth(headers, url, {
    baseUrl: connection.baseUrl,
    authType: connection.authType,
    credentials: (connection.credentials as ApiCredentials) ?? {},
    authConfig: (connection.authConfig as AuthConfig | null) ?? undefined,
    httpConfig: {
      method: 'GET',
      path: '/',
      contentType: 'application/json',
      pathParams: [],
      queryParams: [],
      headerParams: [],
    },
  });

  // ── Fire the request ─────────────────────────────────────────────────────
  const TIMEOUT_MS = 10_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const started = Date.now();
  let status = 0;
  let ok = false;
  let message = '';
  let errorMsg: string | undefined;

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    status = response.status;
    ok = response.status < 400;

    if (ok) {
      message = `Reachable — ${response.status} ${response.statusText}`;
    } else if (response.status === 401 || response.status === 403) {
      message = `Server reachable but credentials may be incorrect (${response.status})`;
      errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    } else if (response.status === 404) {
      // 404 on the base URL is normal for many APIs — host is alive
      ok = true;
      message = `Reachable — base URL returns 404 (normal for many APIs)`;
    } else {
      message = `Unexpected response: ${response.status} ${response.statusText}`;
      errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (error) {
    clearTimeout(timeout);
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    errorMsg = isTimeout
      ? `Timed out after ${TIMEOUT_MS / 1000}s — host may be unreachable`
      : (error instanceof Error ? error.message : String(error));
    message = errorMsg;
  }

  const latencyMs = Date.now() - started;
  const healthStatus = ok ? 'ok' : 'error';

  // ── Persist result ───────────────────────────────────────────────────────
  await db.externalApiConnection.update({
    where: { id: connectionId },
    data: {
      lastHealthCheck: new Date(),
      lastHealthStatus: healthStatus,
    },
  }).catch((err) => {
    log.warn('Could not persist health check result', {
      connectionId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  log.info(`Health check for connection ${connectionId}`, {
    name: connection.name,
    ok,
    status,
    latencyMs,
  });

  return NextResponse.json({
    ok,
    status,
    latencyMs,
    message,
    error: errorMsg,
  });
}
