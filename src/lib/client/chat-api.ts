/**
 * Client-side API service for the Sandra chat interface.
 * Handles communication with /api/chat, /api/chat/stream, and /api/conversations.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface SendMessageParams {
  message: string;
  sessionId?: string;
  userId?: string;
  language?: 'en' | 'fr' | 'ht';
}

export interface SendMessageResult {
  response: string;
  sessionId: string;
  language: string;
  toolsUsed: string[];
  retrievalUsed: boolean;
}

export interface StreamMessageParams {
  message: string;
  sessionId?: string;
  userId?: string;
  language?: 'en' | 'fr' | 'ht';
}

export interface StreamMessageResult {
  sessionId: string;
  response: string;
  toolsUsed: string[];
  retrievalUsed: boolean;
  suggestedFollowUps: string[];
}

/**
 * Send a message via the non-streaming /api/chat endpoint.
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await response.json();

  if (!response.ok) {
    const message = json?.error?.message ?? 'Failed to send message';
    throw new Error(message);
  }

  return json.data as SendMessageResult;
}

/**
 * Stream a message via the SSE /api/chat/stream endpoint.
 * Calls onToken for each streamed token and resolves with the final result.
 */
export async function streamMessage(
  params: StreamMessageParams,
  onToken: (token: string) => void,
  onToolCall?: (toolName: string) => void,
): Promise<StreamMessageResult> {
  const httpResponse = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!httpResponse.ok) {
    const json = await httpResponse.json().catch(() => ({}));
    const message = (json as Record<string, unknown>)?.error?.toString() ?? 'Failed to start stream';
    throw new Error(message);
  }

  const reader = httpResponse.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let sessionId = params.sessionId ?? '';
  let finalResponse = '';
  let toolsUsed: string[] = [];
  let retrievalUsed = false;
  let suggestedFollowUps: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events: split on double newlines
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const lines = part.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(data) as Record<string, unknown>;
          } catch {
            // Skip unparseable events
            continue;
          }

          switch (event.type) {
            case 'start':
              if (event.sessionId) sessionId = String(event.sessionId);
              break;
            case 'chunk':
            case 'token':
              onToken(String(event.content ?? event.data ?? ''));
              break;
            case 'tool':
            case 'tool_call':
              onToolCall?.(String(event.name ?? event.data ?? ''));
              break;
            case 'done':
              if (event.toolsUsed && Array.isArray(event.toolsUsed)) {
                toolsUsed = event.toolsUsed as string[];
              }
              if (typeof event.response === 'string') {
                finalResponse = event.response;
              }
              if (typeof event.retrievalUsed === 'boolean') {
                retrievalUsed = event.retrievalUsed;
              }
              if (event.suggestedFollowUps && Array.isArray(event.suggestedFollowUps)) {
                suggestedFollowUps = event.suggestedFollowUps as string[];
              }
              if (event.sessionId) sessionId = String(event.sessionId);
              break;
            case 'error':
              throw new Error(String(event.message ?? event.data ?? 'Stream error'));
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { sessionId, response: finalResponse, toolsUsed, retrievalUsed, suggestedFollowUps };
}

/**
 * Fetch conversation history for a session.
 */
export async function getConversation(sessionId: string): Promise<{
  sessionId: string;
  language?: string | null;
  messages: ChatMessage[];
}> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(sessionId)}`);
  const json = await response.json();

  if (!response.ok) {
    const message = json?.error?.message ?? 'Failed to fetch conversation';
    throw new Error(message);
  }

  return json.data as { sessionId: string; language?: string | null; messages: ChatMessage[] };
}
