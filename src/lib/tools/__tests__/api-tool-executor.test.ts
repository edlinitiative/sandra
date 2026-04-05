/**
 * Tests for the API tool executor.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeApiTool, type ApiToolExecutionContext } from '../api-tool-executor';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

type FetchCall = [string, RequestInit & { method: string; headers: Record<string, string>; body?: string }];
/** Type-safe accessor for mock.calls[0] */
function lastCall(): FetchCall { return mockFetch.mock.calls[0] as FetchCall; }

beforeEach(() => {
  mockFetch.mockReset();
});

function makeContext(overrides: Partial<ApiToolExecutionContext> = {}): ApiToolExecutionContext {
  return {
    baseUrl: 'https://api.example.com/v1',
    authType: 'none',
    credentials: {},
    httpConfig: {
      method: 'GET',
      path: '/users',
      contentType: 'application/json',
      pathParams: [],
      queryParams: [],
      headerParams: [],
    },
    ...overrides,
  };
}

describe('executeApiTool', () => {
  it('should make a GET request with no params', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ users: [{ id: 1, name: 'Alice' }] }),
    });

    const result = await executeApiTool({}, makeContext());

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ users: [{ id: 1, name: 'Alice' }] });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = lastCall();
    
    expect(url).toContain('/users');
    expect(opts.method).toBe('GET');
  });

  it('should interpolate path parameters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: '123', name: 'Alice' }),
    });

    const ctx = makeContext({
      httpConfig: {
        method: 'GET',
        path: '/users/{userId}',
        contentType: 'application/json',
        pathParams: ['userId'],
        queryParams: [],
        headerParams: [],
      },
    });

    const result = await executeApiTool({ userId: '123' }, ctx);

    expect(result.success).toBe(true);
    const [url] = lastCall();
    expect(url).toContain('/users/123');
    expect(url).not.toContain('{userId}');
  });

  it('should return error for missing path param', async () => {
    const ctx = makeContext({
      httpConfig: {
        method: 'GET',
        path: '/users/{userId}',
        contentType: 'application/json',
        pathParams: ['userId'],
        queryParams: [],
        headerParams: [],
      },
    });

    const result = await executeApiTool({}, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required path parameter: userId');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should add query parameters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ([]),
    });

    const ctx = makeContext({
      httpConfig: {
        method: 'GET',
        path: '/users',
        contentType: 'application/json',
        pathParams: [],
        queryParams: ['page', 'limit'],
        headerParams: [],
      },
    });

    await executeApiTool({ page: 2, limit: 10 }, ctx);

    const [url] = lastCall();
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
  });

  it('should send JSON body for POST requests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 'new-1' }),
    });

    const ctx = makeContext({
      httpConfig: {
        method: 'POST',
        path: '/users',
        contentType: 'application/json',
        pathParams: [],
        queryParams: [],
        headerParams: [],
      },
    });

    const result = await executeApiTool({ name: 'Alice', email: 'alice@example.com' }, ctx);

    expect(result.success).toBe(true);
    expect(result.status).toBe(201);
    const [, opts] = lastCall();
    expect(opts.method).toBe('POST');
    expect(opts.body).toContain('"name":"Alice"');
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('should apply API key auth via header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });

    const ctx = makeContext({
      authType: 'api_key',
      credentials: { apiKey: 'sk-test-123' },
      authConfig: { headerName: 'Authorization' },
    });

    await executeApiTool({}, ctx);

    const [, opts] = lastCall();
    expect(opts.headers['Authorization']).toBe('sk-test-123');
  });

  it('should apply API key auth via query param', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });

    const ctx = makeContext({
      authType: 'api_key',
      credentials: { apiKey: 'key-456' },
      authConfig: { apiKeyLocation: 'query', queryParam: 'token' },
    });

    await executeApiTool({}, ctx);

    const [url] = lastCall();
    expect(url).toContain('token=key-456');
  });

  it('should apply bearer token auth', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });

    const ctx = makeContext({
      authType: 'bearer',
      credentials: { bearerToken: 'my-jwt-token' },
    });

    await executeApiTool({}, ctx);

    const [, opts] = lastCall();
    expect(opts.headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('should apply basic auth', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });

    const ctx = makeContext({
      authType: 'basic',
      credentials: { username: 'admin', password: 'secret' },
    });

    await executeApiTool({}, ctx);

    const [, opts] = lastCall();
    const expected = Buffer.from('admin:secret').toString('base64');
    expect(opts.headers['Authorization']).toBe(`Basic ${expected}`);
  });

  it('should handle non-200 responses as errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'User not found' }),
    });

    const result = await executeApiTool({}, makeContext());

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toContain('404');
    expect(result.data).toEqual({ error: 'User not found' });
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await executeApiTool({}, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('should include default headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });

    const ctx = makeContext({
      defaultHeaders: { 'X-Tenant-Id': 'acme-123', 'X-Custom': 'foo' },
    });

    await executeApiTool({}, ctx);

    const [, opts] = lastCall();
    expect(opts.headers['X-Tenant-Id']).toBe('acme-123');
    expect(opts.headers['X-Custom']).toBe('foo');
  });

  it('should handle plain text responses', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'Hello, world!',
    });

    const result = await executeApiTool({}, makeContext());

    expect(result.success).toBe(true);
    expect(result.data).toBe('Hello, world!');
  });
});
