/**
 * api-tool-executor.ts
 *
 * Runtime HTTP executor for tools generated from OpenAPI specs.
 * Called by the DynamicTool handler to make actual HTTP requests
 * to external APIs using the stored credentials and spec metadata.
 *
 * Supports auth types: api_key, bearer, oauth2, basic, none.
 */

import { createLogger } from '@/lib/utils';
import type { ParsedApiTool } from './openapi-parser';

const log = createLogger('tools:api-executor');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiCredentials {
  /** For authType=api_key */
  apiKey?: string;
  /** For authType=bearer */
  bearerToken?: string;
  /** For authType=oauth2 (client credentials) */
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  accessToken?: string;
  /** For authType=basic */
  username?: string;
  password?: string;
}

export interface AuthConfig {
  /** Where to send the API key: "header" (default), "query" */
  apiKeyLocation?: 'header' | 'query';
  /** Header name for API key auth (default: "X-API-Key") */
  headerName?: string;
  /** Query param name for API key auth (default: "api_key") */
  queryParam?: string;
}

export interface ApiToolExecutionContext {
  /** Base URL of the API: "https://api.acme.com/v1" */
  baseUrl: string;
  /** Auth type: "api_key" | "bearer" | "oauth2" | "basic" | "none" */
  authType: string;
  /** Stored credentials */
  credentials: ApiCredentials;
  /** Auth configuration */
  authConfig?: AuthConfig;
  /** Default headers to send with every request */
  defaultHeaders?: Record<string, string>;
  /** HTTP spec from the parsed tool */
  httpConfig: ParsedApiTool['httpConfig'];
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
}

export interface ApiToolResult {
  success: boolean;
  status: number;
  data: unknown;
  error?: string;
}

// ─── Executor ────────────────────────────────────────────────────────────────

/**
 * Execute an HTTP request to an external API based on the parsed tool spec.
 *
 * @param input   The tool's input parameters (as provided by the LLM)
 * @param ctx     Execution context with base URL, auth, and HTTP config
 */
export async function executeApiTool(
  input: Record<string, unknown>,
  ctx: ApiToolExecutionContext,
): Promise<ApiToolResult> {
  const { baseUrl, httpConfig, timeoutMs = 30_000 } = ctx;

  try {
    // 1. Build the URL with path parameters interpolated
    let urlPath = httpConfig.path;
    for (const param of httpConfig.pathParams) {
      const value = input[param];
      if (value === undefined || value === null) {
        return { success: false, status: 0, data: null, error: `Missing required path parameter: ${param}` };
      }
      urlPath = urlPath.replace(`{${param}}`, encodeURIComponent(String(value)));
    }

    const url = new URL(urlPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

    // 2. Add query parameters
    for (const param of httpConfig.queryParams) {
      const value = input[param];
      if (value !== undefined && value !== null) {
        url.searchParams.set(param, String(value));
      }
    }

    // 3. Build headers
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Sandra/1.0',
      ...(ctx.defaultHeaders ?? {}),
    };

    // Add operation-level header parameters
    for (const param of httpConfig.headerParams) {
      const value = input[param];
      if (value !== undefined && value !== null) {
        headers[param] = String(value);
      }
    }

    // 4. Apply authentication
    applyAuth(headers, url, ctx);

    // 5. Build request body (for POST/PUT/PATCH)
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(httpConfig.method)) {
      // Collect body fields: everything NOT a path, query, or header param
      const nonBodyParams = new Set([
        ...httpConfig.pathParams,
        ...httpConfig.queryParams,
        ...httpConfig.headerParams,
      ]);
      const bodyFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (!nonBodyParams.has(key)) {
          bodyFields[key] = value;
        }
      }

      // If there's a single "body" key, unwrap it
      if (Object.keys(bodyFields).length === 1 && 'body' in bodyFields) {
        body = typeof bodyFields.body === 'string'
          ? bodyFields.body
          : JSON.stringify(bodyFields.body);
      } else if (Object.keys(bodyFields).length > 0) {
        body = JSON.stringify(bodyFields);
      }

      if (body) {
        headers['Content-Type'] = httpConfig.contentType || 'application/json';
      }
    }

    // 6. Execute the request
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    log.info(`API call: ${httpConfig.method} ${url.pathname}`, {
      baseUrl: url.origin,
      hasBody: Boolean(body),
    });

    const response = await fetch(url.toString(), {
      method: httpConfig.method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // 7. Parse response
    const contentType = response.headers.get('content-type') ?? '';
    let data: unknown;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      // Truncate very large text responses
      data = text.length > 10_000 ? text.slice(0, 10_000) + '... [truncated]' : text;
    }

    if (!response.ok) {
      log.warn(`API call failed: ${httpConfig.method} ${url.pathname} → ${response.status}`, {
        status: response.status,
      });
      return {
        success: false,
        status: response.status,
        data,
        error: `API returned ${response.status}: ${response.statusText}`,
      };
    }

    return { success: true, status: response.status, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, status: 0, data: null, error: `Request timed out after ${timeoutMs}ms` };
    }

    const msg = error instanceof Error ? error.message : String(error);
    log.error('API tool execution error', { error: msg });
    return { success: false, status: 0, data: null, error: msg };
  }
}

// ─── Auth helpers ────────────────────────────────────────────────────────────

export function applyAuth(
  headers: Record<string, string>,
  url: URL,
  ctx: ApiToolExecutionContext,
): void {
  const { authType, credentials, authConfig } = ctx;

  switch (authType) {
    case 'api_key': {
      const key = credentials.apiKey;
      if (!key) break;

      const location = authConfig?.apiKeyLocation ?? 'header';
      if (location === 'query') {
        url.searchParams.set(authConfig?.queryParam ?? 'api_key', key);
      } else {
        headers[authConfig?.headerName ?? 'X-API-Key'] = key;
      }
      break;
    }

    case 'bearer': {
      const token = credentials.bearerToken ?? credentials.accessToken;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      break;
    }

    case 'oauth2': {
      // Use pre-fetched access token. Token refresh is handled by the health check / admin layer.
      const token = credentials.accessToken;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      break;
    }

    case 'basic': {
      if (credentials.username && credentials.password) {
        const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
      break;
    }

    case 'none':
    default:
      break;
  }
}
