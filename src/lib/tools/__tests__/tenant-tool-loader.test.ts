/**
 * Tests for the tenant tool loader.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before importing the module
vi.mock('@/lib/db', () => ({
  db: {
    dynamicTool: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    externalApiConnection: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

import { db } from '@/lib/db';
import { loadTenantTools, getTenantToolDefinitions, registerApiTools } from '../tenant-tool-loader';

const mockDb = db as unknown as {
  dynamicTool: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  externalApiConnection: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  tenant: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadTenantTools', () => {
  it('should return empty array when tenant has no tools', async () => {
    mockDb.dynamicTool.findMany.mockResolvedValue([]);

    const result = await loadTenantTools('tenant-1');

    expect(result).toEqual([]);
    expect(mockDb.dynamicTool.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', enabled: true },
      }),
    );
  });

  it('should build API-backed tools with handlers', async () => {
    const httpConfig = JSON.stringify({
      method: 'GET',
      path: '/users',
      contentType: 'application/json',
      pathParams: [],
      queryParams: ['page'],
      headerParams: [],
    });

    mockDb.dynamicTool.findMany.mockResolvedValue([
      {
        id: 'tool-1',
        name: 'acme_listUsers',
        description: 'List users',
        parameters: { type: 'object', properties: { page: { type: 'integer' } } },
        handlerCode: `/* __HTTP_CONFIG__=${httpConfig} */\nreturn { success: true, data: input };`,
        requiredScopes: ['api:external'],
        enabled: true,
        tenantId: 'tenant-1',
        apiConnectionId: 'conn-1',
        apiConnection: {
          id: 'conn-1',
          baseUrl: 'https://api.acme.com',
          authType: 'api_key',
          credentials: { apiKey: 'test-key' },
          authConfig: null,
          defaultHeaders: null,
        },
      },
    ]);

    const tools = await loadTenantTools('tenant-1');

    expect(tools.length).toBe(1);
    expect(tools[0]!.definition.name).toBe('acme_listUsers');
    expect(tools[0]!.definition.description).toBe('List users');
    expect(typeof tools[0]!.handler).toBe('function');
  });

  it('should build code-backed tools with eval handler', async () => {
    mockDb.dynamicTool.findMany.mockResolvedValue([
      {
        id: 'tool-2',
        name: 'custom_greet',
        description: 'Greet a user',
        parameters: { type: 'object', properties: { name: { type: 'string' } } },
        handlerCode: 'return { success: true, data: "Hello " + input.name };',
        requiredScopes: ['api:external'],
        enabled: true,
        tenantId: 'tenant-1',
        apiConnectionId: null,
        apiConnection: null,
      },
    ]);

    const tools = await loadTenantTools('tenant-1');

    expect(tools.length).toBe(1);
    expect(tools[0]!.definition.name).toBe('custom_greet');

    // Execute the handler
    const result = await tools[0]!.handler({ name: 'World' }, { sessionId: 's1', scopes: [] });
    expect(result.success).toBe(true);
    expect(result.data).toBe('Hello World');
  });
});

describe('getTenantToolDefinitions', () => {
  it('should return tool definitions without handlers', async () => {
    mockDb.dynamicTool.findMany.mockResolvedValue([
      { name: 'tool_a', description: 'Tool A', parameters: { type: 'object' } },
      { name: 'tool_b', description: 'Tool B', parameters: { type: 'object' } },
    ]);

    const defs = await getTenantToolDefinitions('tenant-1');

    expect(defs.length).toBe(2);
    expect(defs[0]!.name).toBe('tool_a');
    expect(defs[1]!.name).toBe('tool_b');
  });
});

describe('registerApiTools', () => {
  it('should parse spec, create connection, and persist tools', async () => {
    mockDb.externalApiConnection.create.mockResolvedValue({ id: 'conn-new' });
    mockDb.dynamicTool.create.mockResolvedValue({ id: 'tool-new' });

    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {
        '/items': {
          get: {
            operationId: 'listItems',
            summary: 'List items',
            responses: { '200': {} },
          },
          post: {
            operationId: 'createItem',
            summary: 'Create an item',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                    },
                    required: ['name'],
                  },
                },
              },
            },
            responses: { '201': {} },
          },
        },
      },
    };

    const result = await registerApiTools({
      tenantId: 'tenant-1',
      connectionName: 'Test API',
      baseUrl: 'https://api.test.com',
      openApiSpec: spec,
      credentials: { apiKey: 'test' },
    });

    expect(result.success).toBe(true);
    expect(result.connectionId).toBe('conn-new');
    expect(result.toolsCreated).toBe(2);
    expect(result.toolNames).toContain('test_api_listItems');
    expect(result.toolNames).toContain('test_api_createItem');
    expect(mockDb.externalApiConnection.create).toHaveBeenCalledOnce();
    expect(mockDb.dynamicTool.create).toHaveBeenCalledTimes(2);
  });

  it('should return error when spec has no parseable paths', async () => {
    const result = await registerApiTools({
      tenantId: 'tenant-1',
      connectionName: 'Bad API',
      baseUrl: 'https://api.bad.com',
      openApiSpec: { openapi: '3.0.0', info: { title: 'Bad' } },
    });

    expect(result.success).toBe(false);
    expect(result.toolsCreated).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
