import type { ChatMessage } from '@/lib/ai/types';
import type { Session, Message } from '@prisma/client';

/**
 * Memory system type definitions.
 */

/** A stored conversation turn */
export interface ConversationEntry {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/** Short-term session memory (conversation context) */
export interface SessionMemory {
  sessionId: string;
  entries: ConversationEntry[];
  createdAt: Date;
  lastActiveAt: Date;
}

/** Long-term user memory (facts about the user) */
export interface UserMemoryEntry {
  key: string;
  value: string;
  source: string; // 'conversation' | 'profile' | 'inferred'
  confidence: number;
  updatedAt: Date;
}

/** Interface for session memory storage (in-memory, for agent context window) */
export interface SessionMemoryStore {
  /** Get conversation history for a session */
  getHistory(sessionId: string, limit?: number): Promise<ConversationEntry[]>;

  /** Add an entry to session memory */
  addEntry(sessionId: string, entry: ConversationEntry): Promise<void>;

  /** Get session as ChatMessage[] for the AI provider */
  getContextMessages(sessionId: string, limit?: number): Promise<ChatMessage[]>;

  /** Clear session memory */
  clear(sessionId: string): Promise<void>;
}

/** Interface for DB-backed session and message persistence */
export interface ISessionStore {
  createSession(params: {
    id?: string;
    channel?: string;
    language?: string;
    userId?: string;
    title?: string;
  }): Promise<Session>;

  getSession(sessionId: string): Promise<Session | null>;

  updateSession(
    sessionId: string,
    updates: {
      title?: string;
      language?: string;
      isActive?: boolean;
      userId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Session>;

  addMessage(params: {
    sessionId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    language?: string;
    toolName?: string;
    toolCallId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Message>;

  getMessages(
    sessionId: string,
    options?: { limit?: number; order?: 'asc' | 'desc' },
  ): Promise<Message[]>;

  loadContext(sessionId: string, maxMessages?: number): Promise<ChatMessage[]>;
}

/** Interface for long-term user memory */
export interface UserMemoryStore {
  /** Get all memories for a user */
  getMemories(userId: string): Promise<UserMemoryEntry[]>;

  /** Get a specific memory by key */
  getMemory(userId: string, key: string): Promise<UserMemoryEntry | null>;

  /** Save or update a memory */
  saveMemory(userId: string, entry: UserMemoryEntry): Promise<void>;

  /** Delete a memory */
  deleteMemory(userId: string, key: string): Promise<void>;

  /** Get a summary string of user memories for prompt injection */
  getMemorySummary(userId: string): Promise<string>;
}
