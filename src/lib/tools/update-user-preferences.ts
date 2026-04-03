/**
 * updateUserPreferences — update the user's platform preferences.
 *
 * Allows users to change their language, preferred channel, timezone, or display name.
 * Updates are persisted to both the User DB record and the memory store so the
 * AI agent can reference them in future conversations.
 *
 * Required scopes: profile:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';
import { getUserMemoryStore } from '@/lib/memory/user-memory';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'ht', 'es', 'pt'] as const;
const SUPPORTED_CHANNELS = ['whatsapp', 'web', 'voice', 'sms'] as const;

const inputSchema = z.object({
  language: z
    .enum(SUPPORTED_LANGUAGES)
    .optional()
    .describe("Preferred language: 'en' (English), 'fr' (French), 'ht' (Haitian Creole), 'es' (Spanish), 'pt' (Portuguese)."),
  channel: z
    .enum(SUPPORTED_CHANNELS)
    .optional()
    .describe("Preferred channel: 'whatsapp', 'web', 'voice', or 'sms'."),
  timezone: z
    .string()
    .max(64)
    .optional()
    .describe("IANA timezone string, e.g. 'America/Port-au-Prince', 'UTC', 'Europe/Paris'."),
  name: z
    .string()
    .min(1)
    .max(128)
    .optional()
    .describe("Display name / preferred name to use in responses."),
});

const updateUserPreferencesTool: SandraTool = {
  name: 'updateUserPreferences',
  description:
    "Update the user's platform preferences: language, communication channel, timezone, or display name. Use when the user says 'change my language to French', 'call me ...', 'I'm in timezone ...', or 'switch to WhatsApp'.",
  parameters: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        enum: [...SUPPORTED_LANGUAGES],
        description: "Preferred language code: en, fr, ht, es, pt",
      },
      channel: {
        type: 'string',
        enum: [...SUPPORTED_CHANNELS],
        description: "Preferred communication channel",
      },
      timezone: {
        type: 'string',
        description: "IANA timezone (e.g. 'America/Port-au-Prince')",
      },
      name: {
        type: 'string',
        description: "Preferred display name",
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
      return { success: false, data: null, error: 'Authentication required to update preferences.' };
    }

    const hasChanges = params.language || params.channel || params.timezone || params.name;
    if (!hasChanges) {
      return { success: false, data: null, error: 'At least one preference must be specified.' };
    }

    try {
      // Build DB update payload (only fields the schema supports)
      const dbUpdate: Record<string, string> = {};
      if (params.language) dbUpdate.language = params.language;
      if (params.channel) dbUpdate.channel = params.channel;
      if (params.name) dbUpdate.name = params.name;

      let updatedUser: { name: string | null; language: string | null; channel: string | null } | null = null;
      if (Object.keys(dbUpdate).length > 0) {
        updatedUser = await db.user.update({
          where: { id: userId },
          data: dbUpdate,
          select: { name: true, language: true, channel: true },
        });
      }

      // Also persist to memory store for AI context
      const store = getUserMemoryStore();
      const memoryWrites: Promise<void>[] = [];
      const now = new Date();

      if (params.language) {
        const langNames: Record<string, string> = {
          en: 'English', fr: 'French', ht: 'Haitian Creole', es: 'Spanish', pt: 'Portuguese',
        };
        memoryWrites.push(store.saveMemory(userId, {
          key: 'preferred_language',
          value: langNames[params.language] ?? params.language,
          source: 'user_explicit',
          confidence: 1.0,
          updatedAt: now,
        }));
      }

      if (params.channel) {
        memoryWrites.push(store.saveMemory(userId, {
          key: 'preferred_channel',
          value: params.channel,
          source: 'user_explicit',
          confidence: 1.0,
          updatedAt: now,
        }));
      }

      if (params.timezone) {
        memoryWrites.push(store.saveMemory(userId, {
          key: 'timezone',
          value: params.timezone,
          source: 'user_explicit',
          confidence: 1.0,
          updatedAt: now,
        }));
      }

      if (params.name) {
        memoryWrites.push(store.saveMemory(userId, {
          key: 'preferred_name',
          value: params.name,
          source: 'user_explicit',
          confidence: 1.0,
          updatedAt: now,
        }));
      }

      await Promise.all(memoryWrites);

      const changes: Record<string, string> = {};
      if (params.language) changes.language = params.language;
      if (params.channel) changes.channel = params.channel;
      if (params.timezone) changes.timezone = params.timezone;
      if (params.name) changes.name = params.name;

      const changeSummary = Object.entries(changes)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      return {
        success: true,
        data: {
          confirmation: `Your preferences have been updated: ${changeSummary}.`,
          updated: changes,
          profile: updatedUser ?? undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to update preferences: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(updateUserPreferencesTool);
export { updateUserPreferencesTool };
