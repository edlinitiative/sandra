import { z } from 'zod';
import { ValidationError } from './errors';

/**
 * Strip HTML tags and trim whitespace from user input.
 */
export function sanitizeInput(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

/** Schema for chat message input (POST /api/chat) */
export const chatInputSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message too long (max 4000 characters)')
    .describe('The user message to send'),
  sessionId: z
    .string()
    .uuid('Invalid session ID format')
    .optional()
    .describe('Optional existing session ID'),
  userId: z
    .string()
    .min(1, 'User ID cannot be empty')
    .optional()
    .describe('Optional stable external user identifier'),
  language: z
    .enum(['en', 'fr', 'ht'])
    .optional()
    .describe('Optional language override (en, fr, ht)'),
});

export type ChatInput = z.infer<typeof chatInputSchema>;

/** Schema for index trigger input (POST /api/index) */
export const indexInputSchema = z.object({
  repoId: z
    .string()
    .min(1, 'Repository ID must not be empty')
    .optional()
    .describe('Optional ID of the repository to index; omit to index all active repositories'),
});

export type IndexInput = z.infer<typeof indexInputSchema>;

/** Schema for validating a UUID session ID */
export const sessionIdSchema = z.string().uuid('Invalid session ID format');

/**
 * Validate data against a Zod schema, throwing a structured error on failure.
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new ValidationError(
      context ? `${context}: validation failed` : 'Validation failed',
      { issues },
    );
  }
  return result.data;
}

/**
 * Generate a short ID from uuid v4 (first 8 chars).
 */
export function shortId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Truncate a string to a max length with ellipsis.
 */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON, returning null on failure.
 */
export function safeJsonParse<T = unknown>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}
