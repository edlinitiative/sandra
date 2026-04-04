/**
 * listUserNotes — retrieve all notes Sandra has remembered about the user.
 *
 * Returns the full long-term memory for the authenticated user,
 * grouped by source (user_explicit, conversation, profile, inferred).
 *
 * Required scopes: profile:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { getUserMemoryStore } from '@/lib/memory/user-memory';

const inputSchema = z.object({
  filter: z
    .enum(['all', 'explicit', 'inferred'])
    .optional()
    .default('all')
    .describe("'all' returns everything; 'explicit' shows only user-set notes; 'inferred' shows AI-observed facts."),
});

const listUserNotesTool: SandraTool = {
  name: 'listUserNotes',
  description:
    "Show all the facts and notes Sandra has remembered about you. Use when the user asks 'what do you know about me?', 'show my notes', 'what have you remembered?'",
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        enum: ['all', 'explicit', 'inferred'],
        description: "Filter by source: 'all', 'explicit' (user-set), or 'inferred' (AI-observed)",
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['profile:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to view memory.' };
    }

    try {
      const store = getUserMemoryStore();
      const allMemories = await store.getMemories(userId);

      let memories = allMemories;
      if (params.filter === 'explicit') {
        memories = allMemories.filter((m) => m.source === 'user_explicit');
      } else if (params.filter === 'inferred') {
        memories = allMemories.filter((m) => m.source !== 'user_explicit');
      }

      if (memories.length === 0) {
        return {
          success: true,
          data: {
            count: 0,
            notes: [],
            message:
              params.filter === 'all'
                ? "I haven't remembered anything about you yet. You can ask me to 'remember' facts!"
                : `No ${params.filter} notes found.`,
          },
        };
      }

      const notes = memories.map((m) => ({
        key: m.key,
        value: m.value,
        source: m.source,
        confidence: m.confidence,
        updatedAt: m.updatedAt instanceof Date
          ? m.updatedAt.toISOString().substring(0, 10)
          : String(m.updatedAt),
      }));

      return {
        success: true,
        data: {
          count: notes.length,
          notes,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve memory: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(listUserNotesTool);
export { listUserNotesTool };
