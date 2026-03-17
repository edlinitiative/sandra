import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSession,
  mockUpdateSession,
  mockGetMessages,
  mockGetMemorySummary,
  mockSaveMemory,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetMemorySummary: vi.fn(),
  mockSaveMemory: vi.fn(),
}));

vi.mock('@/lib/memory/session-store', () => ({
  getPrismaSessionStore: () => ({
    getSession: mockGetSession,
    updateSession: mockUpdateSession,
    getMessages: mockGetMessages,
  }),
}));

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({
    getMemorySummary: mockGetMemorySummary,
    saveMemory: mockSaveMemory,
  }),
}));

import {
  buildConversationSummary,
  extractSessionProfile,
  getSessionContinuityContext,
  rememberConversationInsights,
  refreshConversationSummary,
} from '../session-insights';

describe('session insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
    mockUpdateSession.mockResolvedValue(undefined);
    mockGetMessages.mockResolvedValue([]);
    mockGetMemorySummary.mockResolvedValue('');
    mockSaveMemory.mockResolvedValue(undefined);
  });

  it('extracts profile signals from a message', () => {
    const profile = extractSessionProfile(
      "My name is alice and I'm a student. I want to learn Python. I'm interested in robotics.",
      'fr',
    );

    expect(profile.preferredLanguage).toBe('fr');
    expect(profile.name).toBe('Alice');
    expect(profile.role).toBe('student');
    expect(profile.learningGoals).toContain('Python');
    expect(profile.interests).toContain('robotics');
  });

  it('builds a summary only when the history exceeds the context window', () => {
    const shortSummary = buildConversationSummary([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);
    expect(shortSummary).toBe('');

    const longHistory = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `Message ${index}`,
    }));

    const summary = buildConversationSummary(longHistory);
    expect(summary).toContain('Earlier conversation summary');
    expect(summary).toContain('Earlier user questions/goals');
  });

  it('returns combined session and user memory context', async () => {
    mockGetSession.mockResolvedValue({
      metadata: {
        continuity: {
          profile: {
            preferredLanguage: 'ht',
            learningGoals: ['learn SQL'],
          },
          conversationSummary: 'Earlier conversation summary:\n- Earlier user questions/goals: Learn SQL',
        },
      },
    });
    mockGetMemorySummary.mockResolvedValue('Known facts about the user:\n- role: student');

    const result = await getSessionContinuityContext({
      sessionId: 'session-1',
      userId: 'user-1',
    });

    expect(result.memorySummary).toContain('Known facts from this session');
    expect(result.memorySummary).toContain('Known facts about the user');
    expect(result.conversationSummary).toContain('Earlier conversation summary');
  });

  it('persists extracted insights to the session metadata and user memory', async () => {
    mockGetSession.mockResolvedValue({
      id: 'session-1',
      metadata: null,
    });

    await rememberConversationInsights({
      sessionId: 'session-1',
      userId: 'user-1',
      language: 'en',
      message: 'My name is Alice. I am a developer and I want to learn Rust.',
    });

    expect(mockUpdateSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          continuity: expect.objectContaining({
            profile: expect.objectContaining({
              preferredLanguage: 'en',
              name: 'Alice',
              role: 'developer',
            }),
          }),
        }),
      }),
    );
    expect(mockSaveMemory).toHaveBeenCalled();
  });

  it('refreshes the stored conversation summary from recent messages', async () => {
    mockGetSession.mockResolvedValue({
      id: 'session-1',
      metadata: { continuity: { conversationSummary: '' } },
    });
    mockGetMessages.mockResolvedValue(
      Array.from({ length: 24 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${index}`,
      })),
    );

    await refreshConversationSummary('session-1');

    expect(mockUpdateSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          continuity: expect.objectContaining({
            conversationSummary: expect.stringContaining('Earlier conversation summary'),
          }),
        }),
      }),
    );
  });
});
