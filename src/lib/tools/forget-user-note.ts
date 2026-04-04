/**
 * forgetUserNote — delete a specific memory entry from the user's long-term store.
 *
 * Users can ask Sandra to forget a specific fact by its key.
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
    .describe("The memory key to delete (e.g. 'preferred_language', 'home_address')."),
});

const forgetUserNoteTool: SandraTool = {
  name: 'forgetUserNote',
  description:
    "Delete a specific remembered fact from Sandra's memory. Use when the user says 'forget my X', 'stop remembering X', or 'remove the note about X'.",
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: "Memory key to delete (e.g. 'preferred_language')",
      },
    },
    required: ['key'],
  },
  inputSchema,
  requiredScopes: ['profile:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to modify memory.' };
    }

    try {
      const store = getUserMemoryStore();

      // Check it exists first for a better confirmation message
      const existing = await store.getMemory(userId, params.key);
      if (!existing) {
        return {
          success: false,
          data: null,
          error: `No memory found with key "${params.key}". Use listUserNotes to see what I remember.`,
        };
      }

      await store.deleteMemory(userId, params.key);

      return {
        success: true,
        data: {
          confirmation: `Done! I've forgotten your "${params.key}" (was: "${existing.value}").`,
          key: params.key,
          deletedValue: existing.value,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to delete memory: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(forgetUserNoteTool);
export { forgetUserNoteTool };
