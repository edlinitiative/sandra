import { z } from 'zod';

/**
 * Tool system type definitions.
 */

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
  /** Execute the tool with validated input */
  execute(input: unknown): Promise<ToolResult>;
}

/** Metadata about a registered tool (for admin/debugging) */
export interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  registered: boolean;
}
