/**
 * saveUserNote — explicitly save a key/value fact to the user's long-term memory.
 *
 * Users can tell Sandra to remember specific information about themselves or
 * their preferences that will persist across sessions.
 *
 * Required scopes: profile:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { getUserMemoryStore } from '@/lib/memory/user-memory';

const inputSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(128)
    .describe(
      "The memory key / label (e.g. 'preferred_language', 'home_address', 'favorite_sport'). Use snake_case.",
    ),
  value: z
    .string()
    .min(1)
    .max(1024)
    .describe("The value to store (e.g. 'Haitian Creole', 'Port-au-Prince', 'football')."),
});

const saveUserNoteTool: SandraTool = {
  name: 'saveUserNote',
  description:
    "Remember a specific fact about the user that should persist across sessions. Use when the user says 'remember that...', 'my X is Y', or explicitly asks Sandra to keep a note.",
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: "Memory key / label (e.g. 'preferred_language', 'job_title')",
      },
      value: {
        type: 'string',
        description: 'Value to remember',
      },
    },
    required: ['key', 'value'],
  },
  inputSchema,
  requiredScopes: ['profile:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to save memory.' };
    }

    try {
      const store = getUserMemoryStore();
      await store.saveMemory(userId, {
        key: params.key,
        value: params.value,
        source: 'user_explicit',
        confidence: 1.0,
        updatedAt: new Date(),
      });

      return {
        success: true,
        data: {
          confirmation: `I've noted that your ${params.key} is "${params.value}". I'll remember this for future conversations.`,
          key: params.key,
          value: params.value,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to save memory: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(saveUserNoteTool);
export { saveUserNoteTool };
