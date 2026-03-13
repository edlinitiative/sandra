import { z } from 'zod';

/**
 * Tool system type definitions.
 */

/** Execution context passed to every tool handler */
export interface ToolContext {
  sessionId: string;
  userId?: string;
  scopes: string[];
}

/** Result of a tool execution */
export interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
}

/** Definition of a tool that Sandra can invoke */
export interface SandraTool {
  name: string;
  description: string;
  /** JSON Schema for tool parameters */
  parameters: Record<string, unknown>;
  /** Zod schema for runtime validation of parameters */
  inputSchema: z.ZodSchema;
  /** Required permission scopes to execute this tool */
  requiredScopes: string[];
  /** Execute the tool with validated input and context */
  handler(input: unknown, context: ToolContext): Promise<ToolResult>;
}

/** Metadata about a registered tool (for admin/debugging) */
export interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiredScopes: string[];
  registered: boolean;
}
