/**
 * Tests for the OpenAPI spec parser.
 */

import { describe, it, expect } from 'vitest';
import { parseOpenApiSpec } from '../openapi-parser';

const SAMPLE_SPEC = {
  openapi: '3.0.3',
  info: { title: 'Acme CRM API', version: '1.2.0', description: 'Customer relationship management' },
  servers: [{ url: 'https://api.acme.com/v1' }],
  paths: {
    '/customers': {
      get: {
        operationId: 'listCustomers',
        summary: 'List all customers',
        description: 'Returns a paginated list of customers.',
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 20 }, description: 'Items per page' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        operationId: 'createCustomer',
        summary: 'Create a customer',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Customer name' },
                  email: { type: 'string', description: 'Email address' },
                  phone: { type: 'string', description: 'Phone number' },
                },
                required: ['name', 'email'],
              },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/customers/{customerId}': {
      parameters: [
        { name: 'customerId', in: 'path', required: true, schema: { type: 'string' }, description: 'Customer ID' },
      ],
      get: {
        operationId: 'getCustomer',
        summary: 'Get a customer by ID',
        responses: { '200': { description: 'OK' } },
      },
      put: {
        operationId: 'updateCustomer',
        summary: 'Update a customer',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        operationId: 'deleteCustomer',
        summary: 'Delete a customer',
        responses: { '204': { description: 'Deleted' } },
      },
    },
    '/customers/{customerId}/orders': {
      get: {
        summary: 'List customer orders',
        parameters: [
          { name: 'customerId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'completed', 'cancelled'] } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
  },
};

describe('parseOpenApiSpec', () => {
  it('should extract tools from a valid OpenAPI 3.x spec', () => {
    const result = parseOpenApiSpec(SAMPLE_SPEC);

    expect(result.success).toBe(true);
    expect(result.apiName).toBe('Acme CRM API');
    expect(result.apiVersion).toBe('1.2.0');
    expect(result.tools.length).toBe(6);
  });

  it('should preserve operationIds as tool names', () => {
    const result = parseOpenApiSpec(SAMPLE_SPEC);

    const names = result.tools.map(t => t.name);
    expect(names).toContain('listCustomers');
    expect(names).toContain('createCustomer');
    expect(names).toContain('getCustomer');
    expect(names).toContain('updateCustomer');
    expect(names).toContain('deleteCustomer');
  });

  it('should generate operationId from method+path when missing', () => {
    const result = parseOpenApiSpec(SAMPLE_SPEC);

    // The /customers/{customerId}/orders GET has no operationId
    const ordersTool = result.tools.find(t => t.httpConfig.path === '/customers/{customerId}/orders');
    expect(ordersTool).toBeDefined();
    expect(ordersTool!.name).toMatch(/get/i);
  });

  it('should extract path parameters correctly', () => {
    const result = parseOpenApiSpec(SAMPLE_SPEC);

    const getCustomer = result.tools.find(t => t.name === 'getCustomer');
    expect(getCustomer).toBeDefined();
    expect(getCustomer!.httpConfig.pathParams).toContain('customerId');
    expect(getCustomer!.httpConfig.method).toBe('GET');
  });

  it('should extract query parameters correctly', () => {
    const result = parseOpenApiSpec(SAMPLE_SPEC);

    const listCustomers = result.tools.find(t => t.name === 'listCustomers');
    expect(listCustomers).toBeDefined();
    expect(listCustomers!.httpConfig.queryParams).toContain('page');
    expect(listCustomers!.httpConfig.queryParams).toContain('limit');
  });

  it('should inline request body properties into parameters', () => {
    const result = parseOpenApiSpec(SAMPLE_SPEC);

    const createCustomer = result.tools.find(t => t.name === 'createCustomer');
    expect(createCustomer).toBeDefined();
    const props = createCustomer!.parameters.properties as Record<string, unknown>;
    expect(props).toHaveProperty('name');
    expect(props).toHaveProperty('email');
    expect(props).toHaveProperty('phone');
    expect(createCustomer!.parameters.required).toContain('name');
    expect(createCustomer!.parameters.required).toContain('email');
  });

  it('should set correct HTTP methods', () => {
    const result = parseOpenApiSpec(SAMPLE_SPEC);

    const methods = result.tools.map(t => `${t.httpConfig.method} ${t.httpConfig.path}`);
    expect(methods).toContain('GET /customers');
    expect(methods).toContain('POST /customers');
    expect(methods).toContain('GET /customers/{customerId}');
    expect(methods).toContain('PUT /customers/{customerId}');
    expect(methods).toContain('DELETE /customers/{customerId}');
  });

  it('should apply name prefix when provided', () => {
    const result = parseOpenApiSpec(SAMPLE_SPEC, { prefix: 'acme' });

    expect(result.tools[0]!.name).toMatch(/^acme_/);
  });

  it('should respect maxTools limit', () => {
    const result = parseOpenApiSpec(SAMPLE_SPEC, { maxTools: 2 });

    expect(result.tools.length).toBe(2);
  });

  it('should return error for non-object spec', () => {
    const result = parseOpenApiSpec('not an object');
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/JSON object/);
  });

  it('should return error for spec with no paths', () => {
    const result = parseOpenApiSpec({ openapi: '3.0.0', info: { title: 'Empty' } });
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/No paths/);
  });

  it('should warn for non-3.x spec version but still parse', () => {
    const specWithBadVersion = { ...SAMPLE_SPEC, openapi: '2.0' };
    const result = parseOpenApiSpec(specWithBadVersion);
    expect(result.success).toBe(true);
    expect(result.errors.some(e => e.includes('Expected OpenAPI 3.x'))).toBe(true);
  });

  it('should skip deprecated operations', () => {
    const specWithDeprecated = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/old': {
          get: { operationId: 'oldEndpoint', deprecated: true, responses: { '200': {} } },
        },
        '/new': {
          get: { operationId: 'newEndpoint', summary: 'New', responses: { '200': {} } },
        },
      },
    };

    const result = parseOpenApiSpec(specWithDeprecated);
    expect(result.tools.length).toBe(1);
    expect(result.tools[0]!.name).toBe('newEndpoint');
  });

  it('should handle path-level + operation-level parameter merging', () => {
    const result = parseOpenApiSpec(SAMPLE_SPEC);

    // /customers/{customerId} has path-level param customerId
    // The delete operation should inherit it
    const deleteTool = result.tools.find(t => t.name === 'deleteCustomer');
    expect(deleteTool).toBeDefined();
    expect(deleteTool!.httpConfig.pathParams).toContain('customerId');
    expect(deleteTool!.parameters.required).toContain('customerId');
  });
});
