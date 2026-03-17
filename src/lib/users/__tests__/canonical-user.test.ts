import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveUserByExternalId } = vi.hoisted(() => ({
  mockResolveUserByExternalId: vi.fn(),
}));

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

const { mockPromoteSessionInsightsToUserMemory } = vi.hoisted(() => ({
  mockPromoteSessionInsightsToUserMemory: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {},
  resolveUserByExternalId: mockResolveUserByExternalId,
}));

vi.mock('@/lib/memory/session-store', () => ({
  getPrismaSessionStore: () => ({
    getSession: mockGetSession,
  }),
}));

vi.mock('@/lib/memory/session-insights', () => ({
  promoteSessionInsightsToUserMemory: mockPromoteSessionInsightsToUserMemory,
}));

describe('resolveCanonicalUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
  });

  it('returns the existing session user when no external user id is provided', async () => {
    mockGetSession.mockResolvedValue({ id: 'session_1', userId: 'user_existing' });
    const { resolveCanonicalUser } = await import('../canonical-user');

    const result = await resolveCanonicalUser({
      sessionId: 'session_1',
      language: 'en',
      channel: 'web',
    });

    expect(result).toEqual({ userId: 'user_existing' });
    expect(mockResolveUserByExternalId).not.toHaveBeenCalled();
  });

  it('upserts a canonical user from the external id', async () => {
    mockResolveUserByExternalId.mockResolvedValue({ id: 'user_123', externalId: 'web:test' });
    const { resolveCanonicalUser } = await import('../canonical-user');

    const result = await resolveCanonicalUser({
      sessionId: 'session_2',
      externalUserId: 'web:test',
      language: 'fr',
      channel: 'web',
    });

    expect(mockResolveUserByExternalId).toHaveBeenCalledWith(
      {},
      {
        externalId: 'web:test',
        language: 'fr',
        channel: 'web',
      },
    );
    expect(result).toEqual({
      userId: 'user_123',
      externalUserId: 'web:test',
    });
  });

  it('promotes session insights when linking an existing session to a new user', async () => {
    mockGetSession.mockResolvedValue({ id: 'session_3', userId: null });
    mockResolveUserByExternalId.mockResolvedValue({ id: 'user_123', externalId: 'web:test' });
    const { resolveCanonicalUser } = await import('../canonical-user');

    await resolveCanonicalUser({
      sessionId: 'session_3',
      externalUserId: 'web:test',
      language: 'en',
      channel: 'web',
    });

    expect(mockPromoteSessionInsightsToUserMemory).toHaveBeenCalledWith('session_3', 'user_123');
  });
});
