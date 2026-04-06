/**
 * Google Gemini provider implementation.
 *
 * Implements the AIProvider interface using the @google/generative-ai SDK.
 * Gemini does not offer a native embeddings API comparable to OpenAI's
 * text-embedding-3 — so embeddings delegate to the OpenAI provider.
 *
 * Key format differences vs OpenAI that this adapter handles:
 *   1. System messages → systemInstruction config (not in message history)
 *   2. Tool results  → functionResponse parts in user turns
 *   3. Tool calls    → functionCall parts in model turns
 *   4. Tool input    → parsed object (not JSON string)
 *   5. Tools use FunctionDeclaration format
 */

import {
  GoogleGenerativeAI,
  type Content,
  type FunctionDeclaration,
  type FunctionDeclarationsTool,
  type Part,
} from '@google/generative-ai';
import { createLogger, ProviderError } from '@/lib/utils';
import { env } from '@/lib/config';
import type {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  EmbeddingRequest,
  EmbeddingResponse,
  StreamChunk,
  ToolCall,
} from './types';

const log = createLogger('ai:gemini');

const DEFAULT_MODEL = 'gemini-2.0-flash';

// ─── Message conversion ────────────────────────────────────────────────────────

function convertMessages(messages: ChatMessage[]): {
  systemInstruction: string | undefined;
  history: Content[];
} {
  const systemParts = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content as string);

  const systemInstruction =
    systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

  const history: Content[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    // Tool results → user turn with functionResponse parts
    if (msg.role === 'tool') {
      const responsePart: Part = {
        functionResponse: {
          name: msg.name ?? '',
          response: safeParseJson(msg.content as string),
        },
      };
      const last = history[history.length - 1];
      if (last?.role === 'user') {
        last.parts.push(responsePart);
      } else {
        history.push({ role: 'user', parts: [responsePart] });
      }
      continue;
    }

    // Assistant with tool calls → model turn with functionCall parts
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      const parts: Part[] = [];
      if (msg.content) {
        parts.push({ text: msg.content as string });
      }
      for (const tc of msg.toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.arguments) as Record<string, unknown>;
        } catch {
          /* leave empty */
        }
        parts.push({ functionCall: { name: tc.name, args } });
      }
      history.push({ role: 'model', parts });
      continue;
    }

    // User with multimodal parts — flatten to text
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const text = (msg.content as Array<{ type: string; text?: string }>)
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('\n');
      history.push({ role: 'user', parts: [{ text }] });
      continue;
    }

    // Plain user / assistant
    history.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: (msg.content as string) || '' }],
    });
  }

  return { systemInstruction, history };
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { result: text };
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? env.GEMINI_API_KEY ?? '';
    if (!key) {
      throw new ProviderError('gemini', 'GEMINI_API_KEY is not configured');
    }
    this.client = new GoogleGenerativeAI(key);
  }

  // ── Non-streaming completion ───────────────────────────────────────────────

  async chatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const modelName = request.model ?? env.GEMINI_MODEL ?? DEFAULT_MODEL;
    const { systemInstruction, history } = convertMessages(request.messages);

    try {
      const tools = this.convertTools(request);

      const model = this.client.getGenerativeModel({
        model: modelName,
        ...(systemInstruction
          ? { systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] } }
          : {}),
        ...(tools ? { tools } : {}),
      });

      const lastUserMsg = history.pop();
      const chat = model.startChat({
        history,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 4096,
          stopSequences: request.stop ?? undefined,
        },
      });

      const result = await chat.sendMessage(lastUserMsg?.parts ?? [{ text: '' }]);
      const response = result.response;
      const candidate = response.candidates?.[0];

      if (!candidate) {
        throw new ProviderError('gemini', 'No candidates returned in completion response');
      }

      const textParts: string[] = [];
      const toolCalls: ToolCall[] = [];

      for (const part of candidate.content?.parts ?? []) {
        if ('text' in part && part.text) {
          textParts.push(part.text);
        }
        if ('functionCall' in part && part.functionCall) {
          toolCalls.push({
            id: `gemini_tc_${Math.random().toString(36).slice(2, 10)}`,
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args ?? {}),
          });
        }
      }

      const finishReason =
        toolCalls.length > 0 ? 'tool_calls' : 'stop';

      const usage = response.usageMetadata;

      return {
        content: textParts.join('') || null,
        toolCalls,
        finishReason,
        usage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
        model: modelName,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const msg = error instanceof Error ? error.message : 'Unknown Gemini error';
      log.error('Chat completion failed', { error: msg, model: modelName });
      throw new ProviderError('gemini', msg);
    }
  }

  // ── Streaming completion ───────────────────────────────────────────────────

  async *streamChatCompletion(
    request: ChatCompletionRequest,
  ): AsyncIterable<StreamChunk> {
    const modelName = request.model ?? env.GEMINI_MODEL ?? DEFAULT_MODEL;
    const { systemInstruction, history } = convertMessages(request.messages);

    try {
      const tools = this.convertTools(request);

      const model = this.client.getGenerativeModel({
        model: modelName,
        ...(systemInstruction
          ? { systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] } }
          : {}),
        ...(tools ? { tools } : {}),
      });

      const lastUserMsg = history.pop();
      const chat = model.startChat({
        history,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 4096,
        },
      });

      const result = await chat.sendMessageStream(
        lastUserMsg?.parts ?? [{ text: '' }],
      );

      const toolCalls: ToolCall[] = [];

      for await (const chunk of result.stream) {
        const candidate = chunk.candidates?.[0];
        if (!candidate) continue;

        for (const part of candidate.content?.parts ?? []) {
          if ('text' in part && part.text) {
            yield { content: part.text, toolCalls: null, done: false };
          }
          if ('functionCall' in part && part.functionCall) {
            toolCalls.push({
              id: `gemini_tc_${Math.random().toString(36).slice(2, 10)}`,
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args ?? {}),
            });
          }
        }

        if (candidate.finishReason) {
          yield {
            content: null,
            toolCalls: toolCalls.length > 0 ? toolCalls : null,
            done: true,
          };
          return;
        }
      }

      // Fallback flush
      yield {
        content: null,
        toolCalls: toolCalls.length > 0 ? toolCalls : null,
        done: true,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const msg = error instanceof Error ? error.message : 'Unknown Gemini error';
      log.error('Stream chat completion failed', { error: msg, model: modelName });
      throw new ProviderError('gemini', msg);
    }
  }

  // ── Embeddings — delegate to OpenAI (Gemini embeddings are limited) ────────

  async generateEmbedding(_text: string): Promise<number[]> {
    throw new ProviderError(
      'gemini',
      'Gemini embeddings not supported — use OpenAI for embeddings.',
    );
  }

  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    throw new ProviderError(
      'gemini',
      'Gemini embeddings not supported — use OpenAI for embeddings.',
    );
  }

  // ── Health check ───────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: DEFAULT_MODEL });
      await model.generateContent('ping');
      return true;
    } catch {
      return false;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private convertTools(
    request: ChatCompletionRequest,
  ): FunctionDeclarationsTool[] | undefined {
    if (!request.tools?.length) return undefined;
    if (request.toolChoice === 'none') return undefined;

    return [
      {
        functionDeclarations: request.tools.map((t) => ({
          name: t.name,
          description: t.description,
          // Our tools provide standard JSON Schema objects. The Gemini SDK
          // has stricter typing but accepts them at runtime — cast through.
          parameters: t.parameters,
        })) as unknown as FunctionDeclaration[],
      },
    ];
  }
}
