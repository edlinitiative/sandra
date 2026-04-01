import OpenAI from 'openai';
import { env } from '@/lib/config';
import { createLogger, ProviderError } from '@/lib/utils';
import type {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  StreamChunk,
  ToolCall,
} from './types';

const log = createLogger('ai:openai');

/**
 * OpenAI provider implementation.
 * First-class implementation of the AIProvider interface.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? env.OPENAI_API_KEY,
    });
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model ?? env.OPENAI_MODEL;

    try {
      const messages = request.messages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'tool' as const,
            content: m.content as string,
            tool_call_id: m.toolCallId ?? '',
          };
        }

        if (m.role === 'assistant') {
          return {
            role: 'assistant' as const,
            content: m.content as string,
            tool_calls: m.toolCalls?.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: tc.arguments,
              },
            })),
          };
        }

        // Support multimodal content (vision) for user messages
        if (m.role === 'user' && Array.isArray(m.content)) {
          return {
            role: 'user' as const,
            content: m.content.map(part =>
              part.type === 'text'
                ? { type: 'text' as const, text: part.text }
                : { type: 'image_url' as const, image_url: { url: part.image_url.url, detail: part.image_url.detail ?? 'auto' as const } },
            ),
          };
        }

        return {
          role: m.role as 'system' | 'user',
          content: m.content as string,
        };
      });

      const tools = request.tools?.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      const toolChoice = request.toolChoice
        ? request.toolChoice === 'auto' || request.toolChoice === 'none'
          ? request.toolChoice
          : { type: 'function' as const, function: { name: request.toolChoice.name } }
        : undefined;

      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        tools: tools && tools.length > 0 ? tools : undefined,
        tool_choice: toolChoice,
        stop: request.stop,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new ProviderError('openai', 'No choices returned in completion response');
      }

      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      const finishReason = choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason ?? 'stop';

      return {
        content: choice.message.content,
        toolCalls,
        finishReason: finishReason as ChatCompletionResponse['finishReason'],
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        model: response.model,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const msg = error instanceof Error ? error.message : 'Unknown OpenAI error';
      log.error('Chat completion failed', { error: msg, model });
      throw new ProviderError('openai', msg);
    }
  }

  async * streamChatCompletion(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const model = request.model ?? env.OPENAI_MODEL;

    try {
      const messages = request.messages.map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool' as const, content: m.content as string, tool_call_id: m.toolCallId ?? '' };
        }

        if (m.role === 'assistant') {
          return {
            role: 'assistant' as const,
            content: m.content as string,
            tool_calls: m.toolCalls?.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: tc.arguments,
              },
            })),
          };
        }

        // Support multimodal content (vision) for user messages
        if (m.role === 'user' && Array.isArray(m.content)) {
          return {
            role: 'user' as const,
            content: m.content.map(part =>
              part.type === 'text'
                ? { type: 'text' as const, text: part.text }
                : { type: 'image_url' as const, image_url: { url: part.image_url.url, detail: part.image_url.detail ?? 'auto' as const } },
            ),
          };
        }

        return { role: m.role as 'system' | 'user', content: m.content as string };
      });

      const tools = request.tools?.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));

      const stream = await this.client.chat.completions.create({
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        tools: tools && tools.length > 0 ? tools : undefined,
        stream: true,
      });

      // Accumulate tool call arguments across delta chunks
      const toolCallAccumulator: Record<number, { id: string; name: string; arguments: string }> = {};

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // Accumulate tool call deltas
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCallAccumulator[idx]) {
              toolCallAccumulator[idx] = {
                id: tc.id ?? `toolcall_${idx}`,
                name: tc.function?.name ?? '',
                arguments: '',
              };
            }
            if (tc.function?.arguments) {
              toolCallAccumulator[idx].arguments += tc.function.arguments;
            }
            if (tc.id) toolCallAccumulator[idx].id = tc.id;
            if (tc.function?.name) toolCallAccumulator[idx].name = tc.function.name;
          }
        }

        if (delta.content) {
          yield { content: delta.content, toolCalls: null, done: false };
        }

        if (chunk.choices[0]?.finish_reason) {
          log.info('OpenAI streaming tool call accumulator', {
            model,
            toolCallAccumulator,
          });

          const toolCalls: ToolCall[] = Object.values(toolCallAccumulator).map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          }));
          yield { content: null, toolCalls: toolCalls.length > 0 ? toolCalls : null, done: true };
        }
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const msg = error instanceof Error ? error.message : 'Unknown OpenAI error';
      log.error('Stream chat completion failed', { error: msg, model });
      throw new ProviderError('openai', msg);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const model = env.OPENAI_EMBEDDING_MODEL;
    try {
      const response = await this.client.embeddings.create({ model, input: text });
      const embedding = response.data[0]?.embedding;
      if (!embedding) throw new ProviderError('openai', 'No embedding returned');
      return embedding;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown OpenAI error';
      log.error('Embedding generation failed', { error: msg, model });
      throw new ProviderError('openai', msg);
    }
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model ?? env.OPENAI_EMBEDDING_MODEL;

    try {
      const response = await this.client.embeddings.create({
        model,
        input: request.input,
      });

      return {
        embeddings: response.data.map((d) => d.embedding),
        model: response.model,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          totalTokens: response.usage.total_tokens,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown OpenAI error';
      log.error('Embedding generation failed', { error: msg, model });
      throw new ProviderError('openai', msg);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!env.OPENAI_API_KEY) return false;
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
