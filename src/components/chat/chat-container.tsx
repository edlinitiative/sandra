'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './chat-message';
import { ChatInput, type VoiceResult } from './chat-input';
import { ChatEmptyState } from './chat-empty-state';
import { TypingIndicator } from './typing-indicator';
import { StreamingMessage } from './streaming-message';
import { LanguageSelector } from './language-selector';
import { VoiceConversation, type VoiceConversationHandle } from './voice-conversation';
import { useSession } from '@/hooks/useSession';
import { useUserIdentity } from '@/hooks/useUserIdentity';
import { AmbientParticles } from '@/components/ui/ambient-particles';
import { streamMessage, getConversation, submitFeedback } from '@/lib/client';

type Language = 'en' | 'fr' | 'ht';

const LANG_KEY = 'sandra_language';
const VOICE_QUICK_ACTION = '🎙️ Start voice call now';
const VOICE_QUICK_ACTION_RE = /\b(live\s+voice|voice\s+call|audio\s+call|talk\s+(live|by\s+voice)|speak\s+with\s+you|call\s+you|open\s+voice|start\s+voice)\b/i;

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
  const fallbackIdRef = useRef(crypto.randomUUID());
  const sessionId = storedSessionId ?? fallbackIdRef.current;
  const [language, setLanguageState] = useState<Language>('en');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Abort controller for in-flight streams
  const abortRef = useRef<AbortController | null>(null);

  // Ref-based guard against double-send (survives between React renders)
  const sendingRef = useRef(false);

  // Track whether voice is active so we can pause background work
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const voiceConversationRef = useRef<VoiceConversationHandle | null>(null);

  // Track whether we've attempted to restore so we only do it once
  const restoredRef = useRef(false);

  // Keep latest values in refs so callbacks never go stale
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const languageRef = useRef(language);
  languageRef.current = language;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const storedSessionIdRef = useRef(storedSessionId);
  storedSessionIdRef.current = storedSessionId;

  // ── Language detection on mount ───────────────────────────────────────────
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
  }, []);

  // ── Restore conversation on mount ─────────────────────────────────────────
  // storedSessionId starts null and hydrates asynchronously from localStorage,
  // so we watch for it to become non-null and restore exactly once.
  useEffect(() => {
    if (!storedSessionId || restoredRef.current) return;
    restoredRef.current = true;

    getConversation(storedSessionId)
      .then((data) => {
        // Sync language from server if user hasn't set one locally
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
        if (restored.length > 0) {
          setMessages(restored);
        }
      })
      .catch(() => {
        // Restore failed (e.g. 401 for unauthenticated users or 404).
        // Do NOT clear the session — the session ID is still valid for
        // continuing the conversation even if we can't fetch history.
      });
  }, [storedSessionId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // ── Feedback ──────────────────────────────────────────────────────────────
  const handleFeedback = useCallback(
    (messageId: string, rating: 'up' | 'down') => {
      void submitFeedback({ sessionId: sessionIdRef.current, messageRef: messageId, rating });
    },
    [],
  );

  // ── Voice result (single-turn record → transcribe → respond) ──────────────
  const handleVoiceResult = useCallback(
    (result: VoiceResult) => {
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

      if (!storedSessionIdRef.current && result.sessionId) {
        setSessionId(result.sessionId);
      }

      // Play back the audio response
      if (result.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${result.audio}`);
        audio.play().catch(() => {
          // Autoplay may be blocked
        });
      }
    },
    [setSessionId],
  );

  // ── Send message (streaming) ──────────────────────────────────────────────
  const handleSend = useCallback(
    async (content: string) => {
      // Ref-based guard: survives between React renders, prevents rapid double-send
      if (sendingRef.current) return;
      sendingRef.current = true;

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

      // Cancel any in-flight stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await streamMessage(
          {
            message: content,
            sessionId: sessionIdRef.current,
            userId: userIdRef.current ?? undefined,
            language: languageRef.current,
          },
          (token) => {
            if (controller.signal.aborted) return;
            setActiveToolCall(null);
            streamBufferRef.current += token;
            setStreamingContent(streamBufferRef.current);
          },
          (toolName) => {
            if (controller.signal.aborted) return;
            setActiveToolCall(toolName);
            // Show the streaming bubble immediately so the tool indicator is visible
            if (streamBufferRef.current === '') {
              setStreamingContent('');
            }
          },
          controller.signal,
        );

        if (controller.signal.aborted) return;

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

        if (!storedSessionIdRef.current && result.sessionId) {
          setSessionId(result.sessionId);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

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
            content: `I'm sorry, I encountered an error: ${message}. Please try again.`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        sendingRef.current = false;
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [setSessionId],
  );

  // ── Live voice turn ───────────────────────────────────────────────────────
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

  const getFollowUps = useCallback(
    (msg: Message): string[] | undefined => {
      const existing = msg.followUps ?? [];
      if (msg.role !== 'assistant' || isVoiceActive) {
        return existing.length > 0 ? existing : undefined;
      }

      const hasVoiceAction = existing.some((item) => item.toLowerCase().includes('voice call'));
      const shouldOfferVoiceAction = VOICE_QUICK_ACTION_RE.test(msg.content);

      if (!hasVoiceAction && shouldOfferVoiceAction) {
        return [...existing, VOICE_QUICK_ACTION];
      }

      return existing.length > 0 ? existing : undefined;
    },
    [isVoiceActive],
  );

  const handleFollowUp = useCallback(
    (value: string) => {
      if (value === VOICE_QUICK_ACTION) {
        voiceConversationRef.current?.startConversation();
        return;
      }
      void handleSend(value);
    },
    [handleSend],
  );

  // ── New chat ──────────────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    // Abort any in-flight stream
    abortRef.current?.abort();
    abortRef.current = null;

    setMessages([]);
    setStreamingContent(null);
    setActiveToolCall(null);
    streamBufferRef.current = '';
    setIsLoading(false);
    sendingRef.current = false;
    setError(null);
    clearSession();
    // Generate a fresh fallback session ID so the new chat doesn't reuse the old one
    fallbackIdRef.current = crypto.randomUUID();
    restoredRef.current = false;
  }, [clearSession]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-surface">
      {/* New Chat button — top bar */}
      {messages.length > 0 && (
        <div className="flex shrink-0 items-center justify-end border-b border-outline-variant/10 px-4 py-2">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant/15 bg-surface-container-low/40 px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-all hover:border-outline-variant/30 hover:bg-surface-container hover:text-on-surface active:scale-[0.97]"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            New chat
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="relative flex-1 overflow-y-auto">
        {/* Ambient oracle particles — paused during voice to free CPU */}
        {!isVoiceActive && (
          <AmbientParticles className="pointer-events-none fixed inset-0 z-0 opacity-40" />
        )}
        {messages.length === 0 && !isLoading ? (
          <ChatEmptyState onSend={handleSend} language={language} isLoading={isLoading} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-1 px-3 py-3 sm:px-4 sm:py-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                followUps={getFollowUps(msg)}
                onFollowUp={handleFollowUp}
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
        className="mx-auto w-full max-w-2xl shrink-0 px-2.5 sm:px-4"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* Voice panel — renders content only when active */}
        <VoiceConversation
          ref={voiceConversationRef}
          sessionId={storedSessionId ?? undefined}
          language={language}
          onTurn={handleLiveTurn}
          onActiveChange={setIsVoiceActive}
          onSessionId={(id) => {
            if (!storedSessionIdRef.current) setSessionId(id);
          }}
        />

        {/* Unified input card */}
        <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low/80 shadow-lg shadow-black/20 backdrop-blur-sm">
          <ChatInput
            onSend={handleSend}
            onVoiceResult={handleVoiceResult}
            voiceSessionId={sessionId}
            language={language}
            isLoading={isLoading}
          />
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
