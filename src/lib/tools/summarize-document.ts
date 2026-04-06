/**
 * summarizeDocument — summarize a Google Drive document, Gmail thread, or web URL.
 *
 * Uses the AI model to generate a concise summary of the content.
 *
 * Required scopes: drive:read (for Drive files), gmail:read (for Gmail), public (for URLs)
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { getFileById, getFileContent } from '@/lib/google/drive';
import { getMessage } from '@/lib/google/gmail';
import { getAIProvider } from '@/lib/ai';
import { env } from '@/lib/config';
import { db } from '@/lib/db';

const inputSchema = z.object({
  type: z
    .enum(['drive', 'gmail', 'url'])
    .describe("Source type: 'drive' (Google Drive file), 'gmail' (Gmail message), or 'url' (web page)"),
  id: z
    .string()
    .optional()
    .describe("For 'drive': file ID. For 'gmail': message ID."),
  url: z
    .string()
    .url()
    .optional()
    .describe("For 'url': the full URL to fetch and summarize"),
  maxLength: z
    .number()
    .int()
    .min(50)
    .max(500)
    .optional()
    .default(200)
    .describe('Maximum length of the summary in words (default 200)'),
  language: z
    .enum(['en', 'fr', 'ht'])
    .optional()
    .describe("Language for the summary: 'en', 'fr', or 'ht'. Defaults to the session language."),
});

async function fetchUrlContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Sandra-AI-Agent/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
  const html = await res.text();
  // Strip HTML tags for basic text extraction
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000);
}

const summarizeDocumentTool: SandraTool = {
  name: 'summarizeDocument',
  description:
    "Summarize a Google Drive document, Gmail message, or web page URL. Use when the user asks to summarize, explain, or get a quick overview of a document, email, or webpage. Returns a concise summary in the user's preferred language.",
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['drive', 'gmail', 'url'],
        description: "Source: 'drive' (Drive file ID), 'gmail' (message ID), or 'url' (web URL)",
      },
      id: { type: 'string', description: "Drive file ID or Gmail message ID" },
      url: { type: 'string', format: 'uri', description: "URL to fetch and summarize (when type='url')" },
      maxLength: { type: 'number', description: 'Summary length in words (default 200)', default: 200 },
      language: {
        type: 'string',
        enum: ['en', 'fr', 'ht'],
        description: "Summary language: 'en', 'fr', or 'ht'",
      },
    },
    required: ['type'],
  },
  inputSchema,
  requiredScopes: [],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    let contentToSummarize = '';
    let sourceTitle = '';

    try {
      // ── Fetch content ────────────────────────────────────────────────────────
      if (params.type === 'url') {
        if (!params.url) return { success: false, data: null, error: "A URL is required when type is 'url'." };
        contentToSummarize = await fetchUrlContent(params.url);
        sourceTitle = params.url;

      } else if (params.type === 'drive') {
        if (!params.id) return { success: false, data: null, error: "A file ID is required when type is 'drive'." };
        if (!userId) return { success: false, data: null, error: 'Authentication required to read Drive files.' };

        const tenantId = await resolveTenantForUser(userId);
        if (!tenantId) return { success: false, data: null, error: 'No Google Drive access for your account.' };

        const rawCtx = await resolveGoogleContext(tenantId);
        const ctx = rawCtx.config.driveImpersonateEmail
          ? { ...rawCtx, impersonateEmail: rawCtx.config.driveImpersonateEmail }
          : rawCtx;

        const file = await getFileById(ctx, params.id);
        const content = await getFileContent(ctx, file);
        contentToSummarize = content.text.slice(0, 12000);
        sourceTitle = file.name;

      } else if (params.type === 'gmail') {
        if (!params.id) return { success: false, data: null, error: "A message ID is required when type is 'gmail'." };
        if (!userId) return { success: false, data: null, error: 'Authentication required to read Gmail.' };

        const tenantId = await resolveTenantForUser(userId);
        if (!tenantId) return { success: false, data: null, error: 'No Gmail access for your account.' };

        const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (!user?.email) return { success: false, data: null, error: 'No email associated with your account.' };

        const ctx = await resolveGoogleContext(tenantId, user.email);
        const message = await getMessage(ctx, params.id);
        contentToSummarize = `From: ${message.from}\nSubject: ${message.subject}\n\n${message.body ?? message.snippet}`;
        sourceTitle = message.subject;
      }

      if (!contentToSummarize.trim()) {
        return { success: false, data: null, error: 'No content found to summarize.' };
      }

      // ── Summarize with AI ────────────────────────────────────────────────────
      const langName = params.language === 'fr' ? 'French' : params.language === 'ht' ? 'Haitian Creole (Kreyòl)' : 'English';
      const provider = getAIProvider();

      const response = await provider.chatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are a precise summarizer. Summarize the provided content in ${langName} in no more than ${params.maxLength ?? 200} words. Be concise, clear, and capture the key points. Return only the summary text.`,
          },
          {
            role: 'user',
            content: contentToSummarize,
          },
        ],
        maxTokens: 600,
        temperature: 0.2,
      });

      const summary = response.content?.trim() ?? '';

      return {
        success: true,
        data: {
          source: sourceTitle,
          type: params.type,
          summary,
          language: params.language ?? 'en',
          wordCount: summary.split(/\s+/).length,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to summarize: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(summarizeDocumentTool);
export { summarizeDocumentTool };
