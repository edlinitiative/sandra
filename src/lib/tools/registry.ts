import type { SandraTool, ToolInfo } from './types';
import type { ToolDefinition } from '@/lib/ai/types';
import { createLogger } from '@/lib/utils';

const log = createLogger('tools:registry');

/**
 * Global tool registry.
 * Tools register themselves here; the agent reads from here.
 */
class ToolRegistry {
  private tools = new Map<string, SandraTool>();

  register(tool: SandraTool): void {
    if (this.tools.has(tool.name)) {
      log.warn(`Overwriting existing tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    log.info(`Registered tool: ${tool.name}`);
  }

  get(name: string): SandraTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Get all tools as AI provider ToolDefinitions */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /** Get metadata about all registered tools */
  listTools(): ToolInfo[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      registered: true,
    }));
  }

  /** Get all tool names */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  clear(): void {
    this.tools.clear();
  }
}

export const toolRegistry = new ToolRegistry();
