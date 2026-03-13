import { toolRegistry } from './registry';
import type { ToolResult, ToolContext } from './types';
import { createLogger, AuthError, ValidationError } from '@/lib/utils';

const log = createLogger('tools:executor');

/**
 * Execute a tool by name with the given input and execution context.
 * Validates permissions, validates input, runs the tool.
 */
export async function executeTool(
  name: string,
  input: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const tool = toolRegistry.get(name);

  if (!tool) {
    log.error(`Tool not found: ${name}`);
    return { success: false, data: null, error: `Tool '${name}' not found` };
  }

  // Permission check: all required scopes must be present in context
  const missingScopes = tool.requiredScopes.filter((s) => !context.scopes.includes(s));
  if (missingScopes.length > 0) {
    throw new AuthError(`Missing required scopes for tool '${name}': ${missingScopes.join(', ')}`, {
      tool: name,
      missingScopes,
    });
  }

  // Validate input with Zod schema
  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ValidationError(`Invalid input for tool '${name}': ${issues}`, { tool: name });
  }

  const start = Date.now();
  try {
    log.info(`Executing tool: ${name}`, { sessionId: context.sessionId });
    const result = await tool.handler(parsed.data, context);
    const duration = Date.now() - start;
    log.info(`Tool '${name}' completed in ${duration}ms`, { success: result.success });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Tool '${name}' handler threw after ${duration}ms`, { error: msg });
    return { success: false, data: null, error: msg };
  }
}
