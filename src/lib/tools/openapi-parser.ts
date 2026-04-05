/**
 * openapi-parser.ts
 *
 * Parses an OpenAPI 3.x specification (JSON) and extracts tool definitions
 * that Sandra can register and invoke at runtime.
 *
 * Each path+method combination becomes one tool with:
 *   - A unique name derived from operationId or path+method
 *   - Description from the spec's summary/description
 *   - JSON Schema parameters (merged from path, query, header, body params)
 *   - HTTP metadata (method, path, contentType) stored for the executor
 */

import { createLogger } from '@/lib/utils';
import { load as yamlLoad } from 'js-yaml';

const log = createLogger('tools:openapi-parser');

// ─── Public types ────────────────────────────────────────────────────────────

/** A single tool extracted from an OpenAPI spec */
export interface ParsedApiTool {
  /** Tool name: operationId or generated from method+path */
  name: string;
  /** Human-readable description for the LLM */
  description: string;
  /** JSON Schema for the tool's input parameters */
  parameters: Record<string, unknown>;
  /** HTTP metadata for the executor */
  httpConfig: {
    method: string;        // GET, POST, PUT, PATCH, DELETE
    path: string;          // /users/{userId}/orders
    contentType: string;   // application/json, multipart/form-data, etc.
    /** Path parameters that need to be interpolated */
    pathParams: string[];
    /** Query parameters */
    queryParams: string[];
    /** Header parameters (non-auth) */
    headerParams: string[];
  };
}

/** Result of parsing an OpenAPI spec */
export interface ParseResult {
  success: boolean;
  tools: ParsedApiTool[];
  /** Name of the API from the spec's info.title */
  apiName: string;
  /** Version from info.version */
  apiVersion: string;
  errors: string[];
}

// ─── Minimal OpenAPI 3.x type stubs (we only parse what we need) ─────────────

interface OpenApiSpec {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: Array<{ url?: string }>;
  paths?: Record<string, OpenApiPathItem>;
}

interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  patch?: OpenApiOperation;
  delete?: OpenApiOperation;
  parameters?: OpenApiParameter[];
}

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    description?: string;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
  responses?: Record<string, unknown>;
  tags?: string[];
  deprecated?: boolean;
}

interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: Record<string, unknown>;
  deprecated?: boolean;
}

// ─── HTTP methods we support ─────────────────────────────────────────────────

const SUPPORTED_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse an OpenAPI 3.x spec (as a JSON object) into Sandra tool definitions.
 *
 * @param spec     The OpenAPI spec as a parsed JSON object
 * @param options  Optional: prefix for tool names, max tools to extract
 */
export function parseOpenApiSpec(
  spec: unknown,
  options: { prefix?: string; maxTools?: number } = {},
): ParseResult {
  const errors: string[] = [];
  const tools: ParsedApiTool[] = [];
  const { prefix = '', maxTools = 50 } = options;

  // Validate spec shape
  const s = spec as OpenApiSpec;
  if (!s || typeof s !== 'object') {
    return { success: false, tools: [], apiName: '', apiVersion: '', errors: ['Spec must be a JSON object'] };
  }

  if (!s.openapi?.startsWith('3.')) {
    errors.push(`Expected OpenAPI 3.x, got: ${s.openapi ?? 'missing version'}. Will attempt to parse anyway.`);
  }

  const apiName = s.info?.title ?? 'Unnamed API';
  const apiVersion = s.info?.version ?? '0.0.0';

  if (!s.paths || typeof s.paths !== 'object') {
    return { success: false, tools: [], apiName, apiVersion, errors: ['No paths found in spec'] };
  }

  // Iterate over all paths and methods
  for (const [path, pathItem] of Object.entries(s.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    // Path-level parameters (shared across all methods)
    const pathLevelParams: OpenApiParameter[] = (pathItem as OpenApiPathItem).parameters ?? [];

    for (const method of SUPPORTED_METHODS) {
      const operation = (pathItem as OpenApiPathItem)[method];
      if (!operation || operation.deprecated) continue;

      if (tools.length >= maxTools) {
        errors.push(`Reached max tool limit (${maxTools}). Remaining endpoints skipped.`);
        break;
      }

      try {
        const tool = extractTool(path, method, operation, pathLevelParams, prefix);
        tools.push(tool);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to parse ${method.toUpperCase()} ${path}: ${msg}`);
      }
    }
    if (tools.length >= maxTools) break;
  }

  log.info(`Parsed ${tools.length} tools from "${apiName}" v${apiVersion}`, {
    errorCount: errors.length,
  });

  return {
    success: tools.length > 0,
    tools,
    apiName,
    apiVersion,
    errors,
  };
}

// ─── Text parser (JSON or YAML auto-detect) ──────────────────────────────────

/**
 * Parse an OpenAPI spec from a raw string — either JSON or YAML.
 * Detects the format automatically (JSON starts with `{` or `[`).
 *
 * @param text     Raw spec string (JSON or YAML)
 * @param options  Same options as parseOpenApiSpec
 */
export function parseOpenApiSpecFromText(
  text: string,
  options: { prefix?: string; maxTools?: number } = {},
): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { success: false, tools: [], apiName: '', apiVersion: '', errors: ['Spec is empty'] };
  }

  let parsed: unknown;
  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  try {
    if (looksLikeJson) {
      parsed = JSON.parse(trimmed);
    } else {
      // YAML — js-yaml returns null for empty docs
      parsed = yamlLoad(trimmed);
      if (parsed === null || parsed === undefined) {
        return { success: false, tools: [], apiName: '', apiVersion: '', errors: ['YAML document is empty'] };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const fmt = looksLikeJson ? 'JSON' : 'YAML';
    return { success: false, tools: [], apiName: '', apiVersion: '', errors: [`Failed to parse ${fmt}: ${msg}`] };
  }

  return parseOpenApiSpec(parsed, options);
}

// ─── Tool extraction ─────────────────────────────────────────────────────────

function extractTool(
  path: string,
  method: string,
  op: OpenApiOperation,
  pathLevelParams: OpenApiParameter[],
  prefix: string,
): ParsedApiTool {
  // 1. Derive tool name
  const rawName = op.operationId ?? generateOperationId(method, path);
  const name = prefix ? `${prefix}_${sanitizeName(rawName)}` : sanitizeName(rawName);

  // 2. Description
  const description = [op.summary, op.description].filter(Boolean).join(' — ')
    || `${method.toUpperCase()} ${path}`;

  // 3. Merge parameters (path-level + operation-level, operation wins on conflict)
  const allParams = mergeParameters(pathLevelParams, op.parameters ?? []);

  // 4. Classify parameters
  const pathParams: string[] = [];
  const queryParams: string[] = [];
  const headerParams: string[] = [];
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of allParams) {
    if (param.deprecated) continue;

    const propSchema = param.schema ?? { type: 'string' };
    properties[param.name] = {
      ...stripRefs(propSchema),
      description: param.description ?? undefined,
    };

    if (param.required) required.push(param.name);

    switch (param.in) {
      case 'path':
        pathParams.push(param.name);
        if (!required.includes(param.name)) required.push(param.name);
        break;
      case 'query':
        queryParams.push(param.name);
        break;
      case 'header':
        headerParams.push(param.name);
        break;
    }
  }

  // 5. Request body → flatten into properties as "body" or inline fields
  let contentType = 'application/json';
  if (op.requestBody?.content) {
    const bodyResult = extractRequestBody(op.requestBody);
    contentType = bodyResult.contentType;

    if (bodyResult.schema) {
      // If body schema has properties, inline them; otherwise wrap as "body"
      const bodySchema = stripRefs(bodyResult.schema);
      if (bodySchema.type === 'object' && bodySchema.properties && typeof bodySchema.properties === 'object') {
        for (const [key, val] of Object.entries(bodySchema.properties as Record<string, unknown>)) {
          properties[key] = val;
        }
        if (Array.isArray(bodySchema.required)) {
          for (const r of bodySchema.required) {
            if (typeof r === 'string' && !required.includes(r)) required.push(r);
          }
        }
      } else {
        properties['body'] = {
          ...bodySchema,
          description: op.requestBody.description ?? 'Request body',
        };
        if (op.requestBody.required) required.push('body');
      }
    }
  }

  // 6. Build JSON Schema for the tool
  const parameters: Record<string, unknown> = {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties: false,
  };

  return {
    name,
    description,
    parameters,
    httpConfig: {
      method: method.toUpperCase(),
      path,
      contentType,
      pathParams,
      queryParams,
      headerParams,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate an operationId from method + path: GET /users/{id}/orders → getUsers_id_orders */
function generateOperationId(method: string, path: string): string {
  const clean = path
    .replace(/\{([^}]+)\}/g, '_$1')     // {userId} → _userId
    .replace(/[^a-zA-Z0-9_]/g, '_')     // slashes, dots → underscores
    .replace(/_+/g, '_')                 // collapse multiple underscores
    .replace(/^_|_$/g, '');              // trim leading/trailing underscores
  return `${method}${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}

/** Sanitize a string into a valid tool name */
function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

/** Merge path-level and operation-level parameters (operation wins on name+in collision) */
function mergeParameters(
  pathLevel: OpenApiParameter[],
  opLevel: OpenApiParameter[],
): OpenApiParameter[] {
  const map = new Map<string, OpenApiParameter>();
  for (const p of pathLevel) map.set(`${p.in}:${p.name}`, p);
  for (const p of opLevel) map.set(`${p.in}:${p.name}`, p);
  return Array.from(map.values());
}

/** Extract request body schema and content type */
function extractRequestBody(
  body: NonNullable<OpenApiOperation['requestBody']>,
): { schema: Record<string, unknown> | null; contentType: string } {
  if (!body.content) return { schema: null, contentType: 'application/json' };

  // Prefer application/json, then form-data, then whatever's first
  const preferred = ['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded'];
  for (const ct of preferred) {
    if (body.content[ct]?.schema) {
      return { schema: body.content[ct].schema as Record<string, unknown>, contentType: ct };
    }
  }

  const first = Object.entries(body.content)[0];
  if (first) {
    return { schema: (first[1]?.schema as Record<string, unknown>) ?? null, contentType: first[0] };
  }

  return { schema: null, contentType: 'application/json' };
}

/**
 * Strip $ref from schemas (flatten to simple types).
 * Full $ref resolution is out of scope — we flatten what we can.
 */
function stripRefs(schema: Record<string, unknown>): Record<string, unknown> {
  if ('$ref' in schema) {
    // Can't resolve $ref without the full spec context; return as string type
    return { type: 'string', description: `Reference: ${schema.$ref}` };
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === '$ref') continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = stripRefs(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
