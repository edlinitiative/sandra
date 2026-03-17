'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { ChatEmptyState } from './chat-empty-state';
import { TypingIndicator } from './typing-indicator';
import { StreamingMessage } from './streaming-message';
import { LanguageSelector } from './language-selector';
import { useSession } from '@/hooks/useSession';
import { streamMessage, getConversation } from '@/lib/client';

type Language = 'en' | 'fr' | 'ht';

const LANG_KEY = 'sandra_language';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  followUps?: string[];
}

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const streamBufferRef = useRef('');
  const { sessionId: storedSessionId, setSessionId, clearSession } = useSession();
  const [newSessionId] = useState(() => crypto.randomUUID());
  const sessionId = storedSessionId ?? newSessionId;
  const [language, setLanguageState] = useState<Language>('en');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Read language preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY) as Language | null;
      if (stored && (['en', 'fr', 'ht'] as string[]).includes(stored)) {
        setLanguageState(stored);
      } else if (typeof navigator !== 'undefined') {
        const browserLang = navigator.language?.slice(0, 2) as Language;
        if ((['en', 'fr', 'ht'] as string[]).includes(browserLang)) {
          setLanguageState(browserLang);
        }
      }
    } catch {
      // Ignore storage errors
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore conversation history on mount when a persisted session exists
  useEffect(() => {
    if (!storedSessionId) return;
    getConversation(storedSessionId)
      .then((data) => {
        if (data.language && (['en', 'fr', 'ht'] as string[]).includes(data.language)) {
          try {
            const storedLanguage = localStorage.getItem(LANG_KEY);
            if (!storedLanguage) {
              localStorage.setItem(LANG_KEY, data.language);
              setLanguageState(data.language as Language);
            }
          } catch {
            setLanguageState(data.language as Language);
          }
        }

        const restored: Message[] = data.messages.map((m) => ({
          id: crypto.randomUUID(),
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        }));
        setMessages(restored);
      })
      .catch(() => {
        clearSession();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleSend = async (content: string) => {
    setError(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    streamBufferRef.current = '';
    setStreamingContent(null);

    try {
      const result = await streamMessage(
        { message: content, sessionId, language },
        (token) => {
          streamBufferRef.current += token;
          setStreamingContent(streamBufferRef.current);
        },
      );

      const finalContent = streamBufferRef.current;
      setStreamingContent(null);
      streamBufferRef.current = '';

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: finalContent || result.response || 'No response received.',
        timestamp: new Date().toISOString(),
        followUps: result.suggestedFollowUps ?? [],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (!storedSessionId && result.sessionId) {
        setSessionId(result.sessionId);
      }
    } catch (err) {
      setStreamingContent(null);
      streamBufferRef.current = '';
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `I'm sorry, I encountered an error: ${message}. Please check that the API is configured correctly and try again.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Language selector bar */}
      <div className="flex items-center justify-end border-b border-gray-100 bg-white/80 px-4 py-2 backdrop-blur">
        <LanguageSelector language={language} onChange={setLanguageState} />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isLoading ? (
          <ChatEmptyState onSend={handleSend} language={language} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                followUps={msg.followUps}
                onFollowUp={handleSend}
              />
            ))}
            {isLoading && streamingContent === null && <TypingIndicator />}
            {streamingContent !== null && <StreamingMessage content={streamingContent} />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="mx-auto w-full max-w-3xl">
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
}
