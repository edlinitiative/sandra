/**
 * tenant-tool-loader.ts
 *
 * Loads tenant-scoped tools from the database and returns them as
 * ToolDefinition arrays ready to merge into the agent's tool set.
 *
 * Unlike the global dynamic-loader (which registers into the singleton
 * toolRegistry), tenant tools are loaded per-request and merged into
 * the tool definitions at agent invocation time. This keeps tenant
 * tools isolated — Tenant A can't see or call Tenant B's tools.
 *
 * Also provides:
 *   registerApiTools() — takes an OpenAPI spec, parses it, and persists
 *                        DynamicTool rows linked to an ExternalApiConnection.
 */

import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';
import { parseOpenApiSpec, type ParsedApiTool } from './openapi-parser';
import { executeApiTool, type ApiCredentials, type AuthConfig } from './api-tool-executor';
import type { ToolResult, ToolContext } from './types';
import type { ToolDefinition } from '@/lib/ai/types';
import { z } from 'zod';

const log = createLogger('tools:tenant-loader');

// ─── Types ───────────────────────────────────────────────────────────────────

/** A tenant tool ready for execution — includes both LLM definition and handler */
export interface TenantTool {
  definition: ToolDefinition;
  inputSchema: z.ZodSchema;
  requiredScopes: string[];
  handler: (input: unknown, context: ToolContext) => Promise<ToolResult>;
}

/** Options for registering tools from an OpenAPI spec */
export interface RegisterApiToolsInput {
  tenantId: string;
  /** Human-readable name for this API connection */
  connectionName: string;
  /** Base URL: "https://api.acme.com/v1" */
  baseUrl: string;
  /** The OpenAPI 3.x spec as a JSON object */
  openApiSpec: Record<string, unknown>;
  /** Auth type */
  authType?: string;
  /** Credentials for calling the API */
  credentials?: ApiCredentials;
  /** Auth configuration (header names, key location) */
  authConfig?: AuthConfig;
  /** Default headers to include in all requests */
  defaultHeaders?: Record<string, string>;
  /** Rate limit in requests per minute (default: 60) */
  rateLimitRpm?: number;
  /** Optional prefix for tool names to avoid collisions */
  namePrefix?: string;
  /** User ID of the person registering this (for audit) */
  createdBy?: string;
}

export interface RegisterApiToolsResult {
  success: boolean;
  connectionId: string;
  toolsCreated: number;
  toolNames: string[];
  errors: string[];
}

// ─── Load tenant tools ───────────────────────────────────────────────────────

/**
 * Load all enabled tools for a specific tenant.
 * Returns an array of TenantTool objects ready for execution.
 *
 * These are NOT registered in the global toolRegistry — they're
 * isolated to this request context.
 */
export async function loadTenantTools(tenantId: string): Promise<TenantTool[]> {
  // Load enabled tools that belong to this tenant
  const rows = await db.dynamicTool.findMany({
    where: {
      tenantId,
      enabled: true,
    },
    include: {
      apiConnection: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (rows.length === 0) return [];

  const tools: TenantTool[] = [];

  for (const row of rows) {
    try {
      // If this tool was generated from an API connection, use the HTTP executor
      if (row.apiConnection) {
        const tool = buildApiTool(row, row.apiConnection);
        if (tool) tools.push(tool);
      } else {
        // Scaffolded/manual tool — use the handlerCode approach (same as dynamic-loader)
        const tool = buildCodeTool(row);
        if (tool) tools.push(tool);
      }
    } catch (error) {
      log.warn(`Failed to load tenant tool '${row.name}'`, {
        tenantId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  log.info(`Loaded ${tools.length} tool(s) for tenant ${tenantId}`);
  return tools;
}

/**
 * Get just the tool definitions (for the LLM) for a tenant.
 * Lighter than loadTenantTools() — no handlers built.
 */
export async function getTenantToolDefinitions(tenantId: string): Promise<ToolDefinition[]> {
  const rows = await db.dynamicTool.findMany({
    where: { tenantId, enabled: true },
    select: { name: true, description: true, parameters: true },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((row) => ({
    name: row.name,
    description: row.description,
    parameters: row.parameters as Record<string, unknown>,
  }));
}

// ─── Register tools from OpenAPI spec ────────────────────────────────────────

/**
 * Parse an OpenAPI spec, create an ExternalApiConnection, and persist
 * DynamicTool rows for each extracted endpoint.
 */
export async function registerApiTools(input: RegisterApiToolsInput): Promise<RegisterApiToolsResult> {
  const {
    tenantId,
    connectionName,
    baseUrl,
    openApiSpec,
    authType = 'api_key',
    credentials = {},
    authConfig,
    defaultHeaders,
    rateLimitRpm = 60,
    namePrefix,
    createdBy,
  } = input;

  // 1. Parse the OpenAPI spec
  const prefix = namePrefix ?? connectionName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const parsed = parseOpenApiSpec(openApiSpec, { prefix });

  if (!parsed.success) {
    return {
      success: false,
      connectionId: '',
      toolsCreated: 0,
      toolNames: [],
      errors: parsed.errors,
    };
  }

  // 2. Create the ExternalApiConnection
  const connection = await db.externalApiConnection.create({
    data: {
      tenantId,
      name: connectionName,
      baseUrl: baseUrl.replace(/\/+$/, ''), // strip trailing slashes
      openApiSpec: openApiSpec as object,
      authType,
      credentials: credentials as object,
      authConfig: authConfig ? (authConfig as object) : undefined,
      defaultHeaders: defaultHeaders ? (defaultHeaders as object) : undefined,
      rateLimitRpm,
    },
  });

  // 3. Create DynamicTool rows for each parsed endpoint
  const toolNames: string[] = [];
  const errors: string[] = [...parsed.errors];

  for (const parsedTool of parsed.tools) {
    try {
      // Build the handler code that delegates to executeApiTool at runtime
      const handlerCode = buildApiHandlerCode(parsedTool);

      await db.dynamicTool.create({
        data: {
          name: parsedTool.name,
          description: parsedTool.description,
          parameters: parsedTool.parameters as object,
          handlerCode,
          requiredScopes: ['api:external'],
          enabled: true,
          tested: false,
          tenantId,
          apiConnectionId: connection.id,
          createdBy: createdBy ?? null,
          sourceGapIds: [],
        },
      });

      toolNames.push(parsedTool.name);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to create tool '${parsedTool.name}': ${msg}`);
    }
  }

  log.info(`Registered ${toolNames.length} tools for connection "${connectionName}"`, {
    tenantId,
    connectionId: connection.id,
  });

  return {
    success: toolNames.length > 0,
    connectionId: connection.id,
    toolsCreated: toolNames.length,
    toolNames,
    errors,
  };
}

// ─── Deregister / cleanup ────────────────────────────────────────────────────

/**
 * Remove an API connection and all its associated tools.
 */
export async function removeApiConnection(connectionId: string): Promise<void> {
  await db.dynamicTool.deleteMany({ where: { apiConnectionId: connectionId } });
  await db.externalApiConnection.delete({ where: { id: connectionId } });
  log.info(`Removed API connection ${connectionId} and its tools`);
}

// ─── Internal builders ───────────────────────────────────────────────────────

interface DynamicToolRow {
  name: string;
  description: string;
  parameters: unknown;
  handlerCode: string;
  requiredScopes: string[];
}

interface ApiConnectionRow {
  id: string;
  baseUrl: string;
  authType: string;
  credentials: unknown;
  authConfig: unknown;
  defaultHeaders: unknown;
}

/**
 * Build a TenantTool from a DynamicTool row that has an associated API connection.
 * The handler will make HTTP calls using executeApiTool.
 */
function buildApiTool(
  row: DynamicToolRow,
  conn: ApiConnectionRow,
): TenantTool | null {
  // The httpConfig is stored in the handlerCode as a JSON header comment
  const httpConfig = extractHttpConfig(row.handlerCode);
  if (!httpConfig) {
    log.warn(`Tool '${row.name}' has no parseable httpConfig in handlerCode`);
    return null;
  }

  return {
    definition: {
      name: row.name,
      description: row.description,
      parameters: row.parameters as Record<string, unknown>,
    },
    inputSchema: z.record(z.unknown()),
    requiredScopes: row.requiredScopes,
    handler: async (input: unknown): Promise<ToolResult> => {
      try {
        const result = await executeApiTool(input as Record<string, unknown>, {
          baseUrl: conn.baseUrl,
          authType: conn.authType,
          credentials: conn.credentials as ApiCredentials,
          authConfig: conn.authConfig as AuthConfig | undefined,
          defaultHeaders: conn.defaultHeaders as Record<string, string> | undefined,
          httpConfig,
        });

        return {
          success: result.success,
          data: result.data,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };
}

/**
 * Build a TenantTool from a scaffolded/manual DynamicTool (uses handlerCode eval).
 */
function buildCodeTool(row: DynamicToolRow): TenantTool | null {
  try {
    const handlerFactory = new Function(
      'fetch', 'JSON', 'Object', 'Array', 'Math', 'Date', 'Promise', 'console',
      `"use strict"; return async function dynamicHandler(input, context) { ${row.handlerCode} };`,
    ) as (...args: unknown[]) => (input: unknown, context: ToolContext) => Promise<ToolResult>;

    const toolConsole = {
      log:   (...a: unknown[]) => log.info(`[tenant:${row.name}] ${String(a[0])}`),
      error: (...a: unknown[]) => log.error(`[tenant:${row.name}] ${String(a[0])}`),
      warn:  (...a: unknown[]) => log.warn(`[tenant:${row.name}] ${String(a[0])}`),
    };

    const handler = handlerFactory(
      globalThis.fetch, JSON, Object, Array, Math, Date, Promise, toolConsole,
    );

    return {
      definition: {
        name: row.name,
        description: row.description,
        parameters: row.parameters as Record<string, unknown>,
      },
      inputSchema: z.record(z.unknown()),
      requiredScopes: row.requiredScopes,
      handler: async (input: unknown, context: ToolContext): Promise<ToolResult> => {
        try {
          const result = await handler(input, context);
          if (typeof result === 'object' && result !== null && 'success' in result) {
            return result as ToolResult;
          }
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            data: null,
            error: `Tenant tool '${row.name}' error: ${error instanceof Error ? error.message : 'unknown'}`,
          };
        }
      },
    };
  } catch (error) {
    log.error(`Failed to compile tenant tool '${row.name}'`, {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

/**
 * Build the handlerCode string for a tool backed by an external API.
 * The httpConfig is embedded as a JSON comment at the top of the handler.
 * At execution time, we parse it out and delegate to executeApiTool.
 */
function buildApiHandlerCode(parsedTool: ParsedApiTool): string {
  const config = JSON.stringify(parsedTool.httpConfig);
  return `/* __HTTP_CONFIG__=${config} */\nreturn { success: true, data: input };`;
}

/** Extract the httpConfig JSON from the handlerCode's comment */
function extractHttpConfig(handlerCode: string): ParsedApiTool['httpConfig'] | null {
  const match = handlerCode.match(/__HTTP_CONFIG__=(\{.*?\})\s*\*\//);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}
