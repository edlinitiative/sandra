'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { ChatEmptyState } from './chat-empty-state';
import { useSession } from '@/hooks/useSession';
import { getConversation } from '@/lib/client';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ht', label: 'Kreyòl Ayisyen', flag: '🇭🇹' },
] as const;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sessionId: storedSessionId, setSessionId, clearSession } = useSession();
  const [newSessionId] = useState(() => crypto.randomUUID());
  const sessionId = storedSessionId ?? newSessionId;
  const [language, setLanguage] = useState<string>(() => {
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language?.slice(0, 2);
      if (['en', 'fr', 'ht'].includes(browserLang)) return browserLang;
    }
    return 'en';
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Restore conversation history on mount when a persisted session exists
  useEffect(() => {
    if (!storedSessionId) return;
    getConversation(storedSessionId)
      .then((data) => {
        const restored: Message[] = data.messages.map((m) => ({
          id: crypto.randomUUID(),
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        }));
        setMessages(restored);
      })
      .catch(() => {
        // Session expired or not found — clear stale ID so a new one is generated
        clearSession();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          sessionId,
          language,
          channel: 'web',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message ?? 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Persist session ID after first successful exchange
      if (!storedSessionId) {
        setSessionId(newSessionId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);

      // Add error message as assistant response
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
        <div className="flex items-center gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                language === lang.code
                  ? 'bg-sandra-100 text-sandra-800 shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
              title={lang.label}
            >
              <span className="mr-1">{lang.flag}</span>
              {lang.code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <ChatEmptyState onSend={handleSend} language={language} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
              />
            ))}
            {isLoading && (
              <ChatMessage role="assistant" content="" isLoading />
            )}
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
