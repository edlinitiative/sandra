'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './chat-message';
import { ChatInput, type VoiceResult } from './chat-input';
import { ChatEmptyState } from './chat-empty-state';
import { TypingIndicator } from './typing-indicator';
import { StreamingMessage } from './streaming-message';
import { LanguageSelector } from './language-selector';
import { VoiceConversation } from './voice-conversation';
import { useSession } from '@/hooks/useSession';
import { useUserIdentity } from '@/hooks/useUserIdentity';
import { AmbientParticles } from '@/components/ui/ambient-particles';
import { streamMessage, getConversation, submitFeedback } from '@/lib/client';


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
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const streamBufferRef = useRef('');
  const { sessionId: storedSessionId, setSessionId, clearSession } = useSession();
  const { userId } = useUserIdentity();
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

  const handleFeedback = useCallback((messageId: string, rating: 'up' | 'down') => {
    void submitFeedback({ sessionId, messageRef: messageId, rating });
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleVoiceResult = useCallback((result: VoiceResult) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `🎤 ${result.transcription}`,
      timestamp: new Date().toISOString(),
    };
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    if (!storedSessionId && result.sessionId) {
      setSessionId(result.sessionId);
    }

    // Play back the audio response
    if (result.audio) {
      const audio = new Audio(`data:audio/mp3;base64,${result.audio}`);
      audio.play().catch(() => {
        // Autoplay may be blocked; user can hear the text in the chat
      });
    }
  }, [storedSessionId, setSessionId]);

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
    setActiveToolCall(null);

    try {
      const result = await streamMessage(
        { message: content, sessionId, userId: userId ?? undefined, language },
        (token) => {
          setActiveToolCall(null);
          streamBufferRef.current += token;
          setStreamingContent(streamBufferRef.current);
        },
        (toolName) => {
          setActiveToolCall(toolName);
          // Show the streaming bubble immediately so the tool indicator is visible
          if (streamingContent === null && streamBufferRef.current === '') {
            setStreamingContent('');
          }
        },
      );

      const finalContent = streamBufferRef.current;
      setStreamingContent(null);
      setActiveToolCall(null);
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
      setActiveToolCall(null);
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

  const handleLiveTurn = useCallback((userText: string, assistantText: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `🎤 ${userText}`,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: assistantText,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  }, []);

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-surface">
      {/* Messages area */}
      <div className="relative flex-1 overflow-y-auto">
        {/* Ambient oracle particles */}
        <AmbientParticles className="pointer-events-none fixed inset-0 z-0 opacity-40" />
        {messages.length === 0 && !isLoading ? (
          <ChatEmptyState onSend={handleSend} language={language} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-1 px-4 py-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                followUps={msg.followUps}
                onFollowUp={handleSend}
                messageId={msg.role === 'assistant' ? msg.id : undefined}
                onFeedback={msg.role === 'assistant' ? handleFeedback : undefined}
              />
            ))}
            {isLoading && streamingContent === null && !activeToolCall && <TypingIndicator />}
            {(streamingContent !== null || activeToolCall) && (
              <StreamingMessage content={streamingContent ?? ''} activeToolCall={activeToolCall} />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-t border-red-500/20 bg-red-950/30 px-4 py-2 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Bottom section ── */}
      <div
        className="mx-auto w-full max-w-2xl shrink-0 px-3 sm:px-4"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {/* Voice panel — renders content only when active */}
        <VoiceConversation
          sessionId={storedSessionId ?? undefined}
          language={language}
          onTurn={handleLiveTurn}
          onSessionId={(id) => { if (!storedSessionId) setSessionId(id); }}
        />

        {/* Unified input card */}
        <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low/80 shadow-lg shadow-black/20 backdrop-blur-sm">
          <ChatInput onSend={handleSend} onVoiceResult={handleVoiceResult} voiceSessionId={sessionId} language={language} isLoading={isLoading} />
        </div>

        {/* Footer row: language selector + disclaimer */}
        <div className="mt-2 flex items-center justify-between px-1">
          <LanguageSelector language={language} onChange={setLanguageState} />
          <span className="text-[10px] text-outline">AI can make mistakes</span>
        </div>
      </div>
    </div>
  );
}
