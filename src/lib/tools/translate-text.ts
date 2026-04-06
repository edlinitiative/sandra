/**
 * translateText — translate text between English, French, and Haitian Creole.
 *
 * Uses the configured AI model (OpenAI) for high-quality translation,
 * especially for Haitian Creole which has limited coverage in traditional APIs.
 *
 * Required scopes: public (none required)
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { getAIProvider } from '@/lib/ai';
import { env } from '@/lib/config';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'French',
  ht: 'Haitian Creole (Kreyòl ayisyen)',
  es: 'Spanish',
  pt: 'Portuguese',
};

const inputSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(3000)
    .describe('The text to translate'),
  targetLanguage: z
    .enum(['en', 'fr', 'ht', 'es', 'pt'])
    .describe("Target language code: 'en' (English), 'fr' (French), 'ht' (Haitian Creole), 'es' (Spanish), 'pt' (Portuguese)"),
  sourceLanguage: z
    .enum(['en', 'fr', 'ht', 'es', 'pt', 'auto'])
    .optional()
    .default('auto')
    .describe("Source language code or 'auto' to detect automatically"),
});

const translateTextTool: SandraTool = {
  name: 'translateText',
  description:
    "Translate text between English, French, Haitian Creole, Spanish, and Portuguese. Use when the user explicitly asks to translate something, or needs content in a specific language. Supports Haitian Creole (Kreyòl ayisyen) with high quality.",
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to translate', maxLength: 3000 },
      targetLanguage: {
        type: 'string',
        enum: ['en', 'fr', 'ht', 'es', 'pt'],
        description: "Target language: 'en', 'fr', 'ht' (Haitian Creole), 'es', 'pt'",
      },
      sourceLanguage: {
        type: 'string',
        enum: ['en', 'fr', 'ht', 'es', 'pt', 'auto'],
        description: "Source language (default: auto-detect)",
        default: 'auto',
      },
    },
    required: ['text', 'targetLanguage'],
  },
  inputSchema,
  requiredScopes: [],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    const targetLangName = LANGUAGE_NAMES[params.targetLanguage] ?? params.targetLanguage;
    const sourceLangNote =
      params.sourceLanguage && params.sourceLanguage !== 'auto'
        ? ` from ${LANGUAGE_NAMES[params.sourceLanguage] ?? params.sourceLanguage}`
        : '';

    try {
      const provider = getAIProvider();

      const systemPrompt = `You are a professional translator specializing in English, French, and Haitian Creole (Kreyòl ayisyen). 
Translate the provided text accurately${sourceLangNote} into ${targetLangName}.
Return ONLY the translated text, with no explanations, notes, or prefixes.
For Haitian Creole, use modern standardized Kreyòl orthography (IPN standard).`;

      const response = await provider.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.text },
        ],
        maxTokens: 1500,
        temperature: 0.1,
      });

      const translation = response.content?.trim() ?? '';

      if (!translation) {
        return { success: false, data: null, error: 'Translation returned empty result.' };
      }

      return {
        success: true,
        data: {
          original: params.text,
          translation,
          targetLanguage: params.targetLanguage,
          targetLanguageName: targetLangName,
          sourceLanguage: params.sourceLanguage ?? 'auto',
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Translation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(translateTextTool);
export { translateTextTool };
