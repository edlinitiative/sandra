/**
 * Anthropic provider implementation.
 *
 * Implements the AIProvider interface using the Anthropic Messages API
 * (https://api.anthropic.com/v1/messages) via raw fetch — no SDK dependency.
 *
 * Key format differences vs OpenAI that this adapter handles:
 *   1. System messages → top-level `system` string (not a message in the array)
 *   2. Tool results → user turn with `tool_result` content blocks (not role:'tool')
 *   3. Assistant tool calls → `tool_use` content blocks in the assistant turn
 *   4. Tool `input` is a parsed object (not a JSON string like OpenAI `arguments`)
 *   5. Tools use `input_schema` instead of `parameters`
 *   6. No embeddings API — throws ProviderError if called
 */

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

const log = createLogger('ai:anthropic');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL     = 'claude-3-5-sonnet-20241022';

// ─── Internal Anthropic API types ─────────────────────────────────────────────

interface AnthropicTextBlock   { type: 'text';     text: string }
interface AnthropicToolUseBlock {
  type:  'tool_use';
  id:    string;
  name:  string;
  input: Record<string, unknown>;
}
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;

interface AnthropicToolResultBlock {
  type:        'tool_result';
  tool_use_id: string;
  content:     string;
}

interface AnthropicMessage {
  role:    'user' | 'assistant';
  content: string | AnthropicContentBlock[] | AnthropicToolResultBlock[];
}

interface AnthropicResponse {
  content:     AnthropicContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage:       { input_tokens: number; output_tokens: number };
  model:       string;
}

// ─── Message conversion ────────────────────────────────────────────────────────

/**
 * Convert our vendor-agnostic ChatMessage array to Anthropic's format.
 *
 * Rules:
 *  - role:'system'    → extracted as top-level `system` string
 *  - role:'tool'      → batched into user turns as tool_result blocks
 *  - role:'assistant' with toolCalls → tool_use content blocks
 *  - role:'user'      → plain string (multimodal parts are flattened to text)
 */
function convertMessages(messages: ChatMessage[]): {
  system:   string | undefined;
  messages: AnthropicMessage[];
} {
  const systemParts = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content as string);

  const system = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

  const converted: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    // tool results → append to existing user turn or start a new one
    if (msg.role === 'tool') {
      const block: AnthropicToolResultBlock = {
        type:        'tool_result',
        tool_use_id: msg.toolCallId ?? '',
        content:     msg.content as string,
      };
      const last = converted[converted.length - 1];
      if (last?.role === 'user' && Array.isArray(last.content)) {
        (last.content as AnthropicToolResultBlock[]).push(block);
      } else {
        converted.push({ role: 'user', content: [block] });
      }
      continue;
    }

    // assistant with tool_calls → tool_use content blocks
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      const content: AnthropicContentBlock[] = [];
      if (msg.content) {
        content.push({ type: 'text', text: msg.content as string });
      }
      for (const tc of msg.toolCalls) {
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(tc.arguments) as Record<string, unknown>; } catch { /* leave empty */ }
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
      }
      converted.push({ role: 'assistant', content });
      continue;
    }

    // user with multimodal parts — flatten to text for now
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const text = (msg.content as Array<{ type: string; text?: string }>)
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('\n');
      converted.push({ role: 'user', content: text });
      continue;
    }

    // plain user / assistant message
    converted.push({
      role:    msg.role as 'user' | 'assistant',
      content: msg.content as string,
    });
  }

  return { system, messages: converted };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? env.ANTHROPIC_API_KEY ?? '';
    if (!this.apiKey) {
      throw new ProviderError('anthropic', 'ANTHROPIC_API_KEY is not configured');
    }
  }

  // ── Non-streaming completion ───────────────────────────────────────────────

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model ?? DEFAULT_MODEL;
    const { system, messages } = convertMessages(request.messages);

    const tools = request.tools?.map((t) => ({
      name:         t.name,
      description:  t.description,
      input_schema: t.parameters,
    }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: request.maxTokens ?? 4096,
      messages,
      ...(system  ? { system }             : {}),
      ...(tools?.length ? { tools }        : {}),
    };

    if (request.toolChoice === 'none') {
      body.tool_choice = { type: 'none' };
    } else if (typeof request.toolChoice === 'object' && request.toolChoice !== null) {
      body.tool_choice = { type: 'tool', name: request.toolChoice.name };
    }

    const res = await fetch(ANTHROPIC_API_URL, {
      method:  'POST',
      headers: this.headers(),
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      log.error('Chat completion failed', { status: res.status });
      throw new ProviderError('anthropic', `API error ${res.status}: ${err}`);
    }

    const data = await res.json() as AnthropicResponse;
    return this.parseResponse(data);
  }

  // ── Streaming completion ───────────────────────────────────────────────────

  async * streamChatCompletion(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const model = request.model ?? DEFAULT_MODEL;
    const { system, messages } = convertMessages(request.messages);

    const tools = request.tools?.map((t) => ({
      name:         t.name,
      description:  t.description,
      input_schema: t.parameters,
    }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: request.maxTokens ?? 4096,
      messages,
      stream: true,
      ...(system      ? { system }  : {}),
      ...(tools?.length ? { tools } : {}),
    };

    const res = await fetch(ANTHROPIC_API_URL, {
      method:  'POST',
      headers: this.headers(),
      body:    JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const err = await res.text();
      throw new ProviderError('anthropic', `API error ${res.status}: ${err}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    // Accumulate tool_use blocks across streaming deltas
    const toolAcc: Record<string, { id: string; name: string; arguments: string }> = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();

        let event: Record<string, unknown>;
        try { event = JSON.parse(raw) as Record<string, unknown>; } catch { continue; }

        const type = event.type as string;

        if (type === 'content_block_start') {
          const block = event.content_block as Record<string, unknown>;
          if (block.type === 'tool_use') {
            const idx = String(event.index);
            toolAcc[idx] = {
              id:        block.id as string,
              name:      block.name as string,
              arguments: '',
            };
          }
        } else if (type === 'content_block_delta') {
          const delta = event.delta as Record<string, unknown>;
          if (delta.type === 'text_delta') {
            yield { content: delta.text as string, toolCalls: null, done: false };
          } else if (delta.type === 'input_json_delta') {
            const idx = String(event.index);
            if (toolAcc[idx]) toolAcc[idx].arguments += delta.partial_json as string;
          }
        } else if (type === 'message_stop' || type === 'message_delta') {
          const toolCalls: ToolCall[] = Object.values(toolAcc).map((tc) => ({
            id:        tc.id,
            name:      tc.name,
            arguments: tc.arguments,
          }));
          yield { content: null, toolCalls: toolCalls.length > 0 ? toolCalls : null, done: true };
          return;
        }
      }
    }

    // Fallback flush
    const toolCalls: ToolCall[] = Object.values(toolAcc).map((tc) => ({
      id: tc.id, name: tc.name, arguments: tc.arguments,
    }));
    yield { content: null, toolCalls: toolCalls.length > 0 ? toolCalls : null, done: true };
  }

  // ── Embeddings — NOT supported ─────────────────────────────────────────────

  async generateEmbedding(_text: string): Promise<number[]> {
    throw new ProviderError('anthropic', 'Anthropic does not offer an embeddings API. Use openai for embeddings.');
  }

  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    throw new ProviderError('anthropic', 'Anthropic does not offer an embeddings API. Use openai for embeddings.');
  }

  // ── Health check ───────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: this.headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      'x-api-key':         this.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type':      'application/json',
    };
  }

  private parseResponse(data: AnthropicResponse): ChatCompletionResponse {
    const textBlocks    = data.content.filter((b): b is AnthropicTextBlock     => b.type === 'text');
    const toolUseBlocks = data.content.filter((b): b is AnthropicToolUseBlock  => b.type === 'tool_use');

    const toolCalls: ToolCall[] = toolUseBlocks.map((b) => ({
      id:        b.id,
      name:      b.name,
      arguments: JSON.stringify(b.input),
    }));

    const finishReason: ChatCompletionResponse['finishReason'] =
      data.stop_reason === 'tool_use'   ? 'tool_calls' :
      data.stop_reason === 'max_tokens' ? 'length'     :
      'stop';

    return {
      content:      textBlocks.map((b) => b.text).join('') || null,
      toolCalls,
      finishReason,
      usage: {
        promptTokens:     data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens:      data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
    };
  }
}
