/**
 * scaffoldTool — meta-tool that generates and hot-registers a new Sandra tool.
 *
 * When Sandra cannot fulfil a request (a CapabilityGap is recorded), an admin
 * can ask her to build the missing tool. She:
 *   1. Reads any referenced CapabilityGap messages for context.
 *   2. Sends a structured prompt to the LLM requesting a JS handler + JSON schema.
 *   3. Persists the result to the DynamicTool table.
 *   4. Hot-registers it in the current registry via reloadDynamicTool().
 *
 * The generated handler runs in a restricted scope (fetch + executeTool only).
 * New tools are available immediately — no restart or redeploy required.
 *
 * Required scopes: admin:tools
 */

import { z } from 'zod';
import OpenAI from 'openai';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { reloadDynamicTool } from './dynamic-loader';
import { logAuditEvent } from '@/lib/audit';
import { env } from '@/lib/config';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';

const log = createLogger('tools:scaffold');

const inputSchema = z.object({
  intent: z
    .string()
    .min(10)
    .max(500)
    .describe(
      'Plain-language description of what the new tool should do, e.g. "send a Slack notification to a webhook URL"',
    ),
  name: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]{2,49}$/)
    .optional()
    .describe(
      'camelCase name for the new tool. Auto-generated from intent if omitted.',
    ),
  sourceGapIds: z
    .array(z.string())
    .optional()
    .default([])
    .describe('CapabilityGap row IDs that triggered this request (for traceability).'),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, return the generated code without saving or registering it.',
    ),
});

const scaffoldToolDef: SandraTool = {
  name: 'scaffoldTool',
  description:
    "Generate and hot-register a new Sandra tool at runtime. Use when the user asks Sandra to do something she currently has no tool for. Describe the intent in plain language; Sandra will write the tool and make it available immediately. ADMIN ONLY.",
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'What the new tool should do (plain language, 10–500 chars)',
      },
      name: {
        type: 'string',
        description: 'camelCase tool name (optional — auto-generated if omitted)',
      },
      sourceGapIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'CapabilityGap IDs that triggered this (optional)',
      },
      dryRun: {
        type: 'boolean',
        description: 'Return code without saving (default false)',
        default: false,
      },
    },
    required: ['intent'],
  },
  inputSchema,
  requiredScopes: ['admin:tools'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required.' };
    }

    // ── 1. Gather context from referenced capability gaps ──────────────────
    let gapContext = '';
    if (params.sourceGapIds && params.sourceGapIds.length > 0) {
      try {
        const gaps = await (db as unknown as CapabilityGapDb).capabilityGap.findMany({
          where: { id: { in: params.sourceGapIds } },
          select: { userMessage: true, patterns: true, channel: true },
        });
        if (gaps.length > 0) {
          gapContext =
            '\n\nUser messages that triggered this request:\n' +
            gaps.map((g) => `- "${g.userMessage}" [${g.patterns.join(', ')}]`).join('\n');
        }
      } catch {
        // non-fatal
      }
    }

    // ── 2. Get names of existing tools to enable composability ─────────────
    const existingTools = toolRegistry.getToolNames().join(', ');

    // ── 3. Generate the tool via LLM ───────────────────────────────────────
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const systemPrompt = `You are a tool scaffolding engine for Sandra, an AI assistant platform.
Your job is to generate a new JavaScript tool handler based on the user's intent.

EXISTING TOOLS the handler may call via executeTool(name, input, context):
${existingTools}

RULES FOR THE GENERATED HANDLER:
1. It receives (input, context) where context = { sessionId, userId, scopes }.
2. Available globals: fetch, executeTool, JSON, Object, Array, Math, Date, Promise, console.
3. NO require(), NO import, NO eval, NO TypeScript syntax.
4. Must always return { success: boolean, data: unknown, error?: string }.
5. Use try/catch around any I/O.
6. Keep it under 60 lines.
7. For HTTP calls, use fetch(url, { method, headers, body }).
8. For composing existing tools, use: const r = await executeTool('toolName', { ...params }, context);

OUTPUT FORMAT — respond with ONLY valid JSON (no markdown, no prose):
{
  "name": "camelCaseToolName",
  "description": "One sentence. What the tool does, when to use it.",
  "parameters": { /* valid JSON Schema object with properties and required array */ },
  "requiredScopes": ["scope1"],
  "handlerCode": "// JS function body here\\nconst result = ..."
}

For requiredScopes, use only scopes from this list:
knowledge:read, repos:read, profile:read, enrollments:read, enrollments:write,
certificates:read, applications:read, applications:write, admin:tools, audit:read,
actions:submit, actions:approve, drive:read, drive:write, contacts:read,
gmail:read, gmail:draft, gmail:send, calendar:write, tasks:write, forms:read,
forms:write, whatsapp:send, whatsapp:groups, zoom:meeting, repos:read`;

    const userPrompt = `Build a tool with this intent: ${params.intent}${gapContext}${
      params.name ? `\n\nPreferred tool name: ${params.name}` : ''
    }`;

    let generated: GeneratedToolSpec;
    try {
      const completion = await openai.chat.completions.create({
        model: env.OPENAI_MODEL ?? 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1200,
      });

      const raw = completion.choices[0]?.message?.content ?? '';
      generated = JSON.parse(raw) as GeneratedToolSpec;
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to generate tool code: ${error instanceof Error ? error.message : 'unknown'}`,
      };
    }

    // ── 4. Basic validation of LLM output ─────────────────────────────────
    if (!generated.name || !generated.handlerCode || !generated.parameters) {
      return {
        success: false,
        data: null,
        error: 'LLM returned incomplete tool spec (missing name, handlerCode, or parameters).',
      };
    }

    // Prevent clobbering a built-in tool
    if (toolRegistry.has(generated.name) && !params.dryRun) {
      return {
        success: false,
        data: null,
        error: `Tool '${generated.name}' already exists. Choose a different name or update it directly.`,
      };
    }

    // ── 5. Dry-run: return the code without persisting ─────────────────────
    if (params.dryRun) {
      return {
        success: true,
        data: {
          dryRun: true,
          generated,
          message: 'Dry run — code generated but NOT saved or registered. Set dryRun: false to deploy.',
        },
      };
    }

    // ── 6. Persist to DynamicTool table ────────────────────────────────────
    try {
      await (db as unknown as DynamicToolDb).dynamicTool.upsert({
        where: { name: generated.name },
        create: {
          name: generated.name,
          description: generated.description,
          parameters: generated.parameters,
          handlerCode: generated.handlerCode,
          requiredScopes: generated.requiredScopes ?? [],
          enabled: true,
          tested: false,
          createdBy: userId,
          sourceGapIds: params.sourceGapIds ?? [],
        },
        update: {
          description: generated.description,
          parameters: generated.parameters,
          handlerCode: generated.handlerCode,
          requiredScopes: generated.requiredScopes ?? [],
          enabled: true,
        },
      });
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to save tool to database: ${error instanceof Error ? error.message : 'unknown'}`,
      };
    }

    // ── 7. Hot-register in the current process ─────────────────────────────
    const registered = await reloadDynamicTool(generated.name);

    await logAuditEvent({
      userId,
      sessionId: context.sessionId,
      action: 'admin_action',
      resource: 'scaffoldTool',
      details: {
        toolName: generated.name,
        intent: params.intent,
        sourceGapIds: params.sourceGapIds,
        registered,
      },
      success: true,
    }).catch(() => {});

    log.info(`Scaffolded new tool: ${generated.name}`, { userId, registered });

    return {
      success: true,
      data: {
        toolName: generated.name,
        description: generated.description,
        requiredScopes: generated.requiredScopes,
        registered,
        message: registered
          ? `✅ Tool '${generated.name}' is now live and ready to use — no restart needed.`
          : `⚠️ Tool '${generated.name}' was saved but could not be hot-registered (code error). Check the handlerCode.`,
        generatedCode: generated.handlerCode,
      },
    };
  },
};

toolRegistry.register(scaffoldToolDef);
export { scaffoldToolDef };

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiredScopes: string[];
  handlerCode: string;
}

interface CapabilityGapDb {
  capabilityGap: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { userMessage: boolean; patterns: boolean; channel: boolean };
    }): Promise<Array<{ userMessage: string; patterns: string[]; channel: string | null }>>;
  };
}

interface DynamicToolDb {
  dynamicTool: {
    upsert(args: {
      where: { name: string };
      create: {
        name: string;
        description: string;
        parameters: unknown;
        handlerCode: string;
        requiredScopes: string[];
        enabled: boolean;
        tested: boolean;
        createdBy: string;
        sourceGapIds: string[];
      };
      update: {
        description: string;
        parameters: unknown;
        handlerCode: string;
        requiredScopes: string[];
        enabled: boolean;
      };
    }): Promise<unknown>;
  };
}
