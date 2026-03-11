import { toolRegistry } from './registry';
import type { ToolResult } from './types';
import { createLogger, ToolExecutionError } from '@/lib/utils';

const log = createLogger('tools:executor');

/**
 * Execute a tool by name with the given arguments (JSON string).
 * Validates input, runs the tool, and returns a structured result.
 */
export async function executeTool(name: string, argsJson: string): Promise<ToolResult> {
  const tool = toolRegistry.get(name);

  if (!tool) {
    log.error(`Tool not found: ${name}`);
    return { success: false, data: null, error: `Tool '${name}' not found` };
  }

  try {
    // Parse arguments
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(argsJson);
    } catch {
      return { success: false, data: null, error: `Invalid JSON arguments for tool '${name}'` };
    }

    // Validate with Zod schema
    const validated = tool.inputSchema.safeParse(parsedArgs);
    if (!validated.success) {
      const issues = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return { success: false, data: null, error: `Validation failed for tool '${name}': ${issues}` };
    }

    log.info(`Executing tool: ${name}`, { args: parsedArgs });
    const result = await tool.execute(validated.data);
    log.info(`Tool ${name} completed`, { success: result.success });

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Tool execution failed: ${name}`, { error: msg });
    throw new ToolExecutionError(name, msg);
  }
}
