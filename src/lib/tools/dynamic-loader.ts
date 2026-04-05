/**
 * dynamic-loader.ts
 *
 * Loads DynamicTool records from the database and hot-registers them in the
 * tool registry at runtime — no server restart or redeployment required.
 *
 * Handler code is plain JavaScript stored as a string in the DB.
 * It runs inside `new Function()` with a restricted set of globals:
 *   - fetch       — for external HTTP calls
 *   - executeTool — to call other Sandra tools (uses the caller's context)
 *   - JSON, Object, Array, Math, Date, Promise, console
 *
 * This module exports:
 *   loadDynamicTools()       — idempotently loads from DB once per process
 *   reloadDynamicTool(name)  — re-registers a specific tool (after update)
 *   ensureDynamicToolsLoaded — promise that resolves once the initial load finishes
 */

import { db } from '@/lib/db';
import { toolRegistry } from './registry';
import { executeTool } from './executor';
import { createLogger } from '@/lib/utils';
import { z } from 'zod';
import type { ToolResult, ToolContext } from './types';

const log = createLogger('tools:dynamic-loader');

// ─── Promise cache (prevent parallel loads) ──────────────────────────────────

let loadPromise: Promise<void> | null = null;

export function ensureDynamicToolsLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = loadDynamicTools().catch((err) => {
      // Reset so a future call can retry
      loadPromise = null;
      log.warn('Dynamic tool load failed — will retry next call', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    });
  }
  return loadPromise;
}

// ─── Loader ──────────────────────────────────────────────────────────────────

/**
 * Fetch all enabled DynamicTools from the DB and register them.
 * Already-registered names are skipped (idempotent).
 */
export async function loadDynamicTools(): Promise<void> {
  const tools = await (db as unknown as DynamicToolDb).dynamicTool.findMany({
    where: { enabled: true },
    orderBy: { createdAt: 'asc' },
  });

  let loaded = 0;
  for (const tool of tools) {
    if (toolRegistry.has(tool.name)) continue;
    const ok = registerDynamicTool(tool);
    if (ok) loaded++;
  }

  if (loaded > 0) {
    log.info(`Loaded ${loaded} dynamic tool(s) from database`);
  }
}

/**
 * Re-register a single dynamic tool by name (call after updating it in DB).
 * If the tool is already registered it is first removed, then re-added.
 */
export async function reloadDynamicTool(name: string): Promise<boolean> {
  const tool = await (db as unknown as DynamicToolDb).dynamicTool.findUnique({
    where: { name },
  });
  if (!tool || !tool.enabled) return false;

  // Remove old registration so register() doesn't throw a duplicate error
  (toolRegistry as unknown as { tools: Map<string, unknown> }).tools.delete(name);

  return registerDynamicTool(tool);
}

// ─── Internal registration ───────────────────────────────────────────────────

function registerDynamicTool(tool: DynamicToolRow): boolean {
  try {
    // Build the handler using new Function() with a controlled set of globals.
    // The function body is stored in DB; it must return { success, data, error? }.
    // Cast the factory to 'unknown' first to avoid circular type reference errors.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const handlerFactory = new Function(
      'fetch',
      'executeTool',
      'JSON',
      'Object',
      'Array',
      'Math',
      'Date',
      'Promise',
      'console',
      `"use strict";
       return async function dynamicHandler(input, context) {
         ${tool.handlerCode}
       };`,
    ) as unknown as (...args: never[]) => (input: unknown, context: ToolContext) => Promise<ToolResult>;

    const toolConsole = {
      log:   (...a: unknown[]) => log.info(`[dyn:${tool.name}] ${String(a[0])}`, a[1] as Record<string, unknown>),
      error: (...a: unknown[]) => log.error(`[dyn:${tool.name}] ${String(a[0])}`, a[1] as Record<string, unknown>),
      warn:  (...a: unknown[]) => log.warn(`[dyn:${tool.name}] ${String(a[0])}`, a[1] as Record<string, unknown>),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (handlerFactory as any)(
      globalThis.fetch,
      executeTool,
      JSON,
      Object,
      Array,
      Math,
      Date,
      Promise,
      toolConsole,
    ) as (input: unknown, context: ToolContext) => Promise<ToolResult>;

    toolRegistry.register({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
      // Dynamic tools use a permissive Zod schema — the LLM-generated handler
      // does its own validation internally.
      inputSchema: z.record(z.unknown()),
      requiredScopes: tool.requiredScopes,
      handler: async (input: unknown, context: ToolContext): Promise<ToolResult> => {
        try {
          const result = await handler(input, context);
          // Ensure the result always conforms to ToolResult shape
          if (
            typeof result === 'object' &&
            result !== null &&
            'success' in result
          ) {
            return result as ToolResult;
          }
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            data: null,
            error: `Dynamic tool '${tool.name}' error: ${
              error instanceof Error ? error.message : 'unknown'
            }`,
          };
        }
      },
    });

    return true;
  } catch (error) {
    log.error(`Failed to register dynamic tool '${tool.name}'`, {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return false;
  }
}

// ─── DB types ─────────────────────────────────────────────────────────────────

interface DynamicToolRow {
  id: string;
  name: string;
  description: string;
  parameters: unknown;
  handlerCode: string;
  requiredScopes: string[];
  enabled: boolean;
  createdAt: Date;
}

interface DynamicToolDb {
  dynamicTool: {
    findMany(args: {
      where?: { enabled?: boolean };
      orderBy?: { createdAt?: 'asc' | 'desc' };
    }): Promise<DynamicToolRow[]>;
    findUnique(args: { where: { name: string } }): Promise<DynamicToolRow | null>;
  };
}
