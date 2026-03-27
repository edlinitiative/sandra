import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGetSession, mockCreateSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockCreateSession: vi.fn(),
}));

const mockStore = {
  getSession: mockGetSession,
  createSession: mockCreateSession,
  updateSession: vi.fn().mockResolvedValue({}),
};

vi.mock('../session-store', () => ({
  getPrismaSessionStore: () => mockStore,
}));

vi.mock('@/lib/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  getSessionLanguage,
  ensureSessionContinuity,
  getOrCreateSessionForChannel,
} from '../session-continuity';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getSessionLanguage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns undefined for undefined sessionId', async () => {
    expect(await getSessionLanguage(undefined)).toBeUndefined();
  });

  it('returns the session language when session exists', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 's1', language: 'fr' });
    expect(await getSessionLanguage('s1')).toBe('fr');
  });

  it('returns undefined when session not found', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    expect(await getSessionLanguage('s1')).toBeUndefined();
  });

  it('returns undefined on error', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('DB down'));
    expect(await getSessionLanguage('s1')).toBeUndefined();
  });
});

describe('ensureSessionContinuity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates session when it does not exist', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    mockCreateSession.mockResolvedValueOnce({ id: 's1' });

    await ensureSessionContinuity({
      sessionId: 's1',
      channel: 'web',
      language: 'en',
      userId: 'u1',
    });

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', channel: 'web', language: 'en', userId: 'u1' }),
    );
  });

  it('updates language when it differs', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 's1', language: 'en', userId: null });

    await ensureSessionContinuity({
      sessionId: 's1',
      channel: 'web',
      language: 'fr',
    });

    expect(mockStore.updateSession).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ language: 'fr' }),
    );
  });

  it('updates userId when session has no userId', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 's1', language: 'en', userId: null });

    await ensureSessionContinuity({
      sessionId: 's1',
      channel: 'web',
      language: 'en',
      userId: 'u1',
    });

    expect(mockStore.updateSession).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  it('does not update when nothing changed', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 's1', language: 'en', userId: 'u1' });

    await ensureSessionContinuity({
      sessionId: 's1',
      channel: 'web',
      language: 'en',
      userId: 'u1',
    });

    expect(mockStore.updateSession).not.toHaveBeenCalled();
  });
});

describe('getOrCreateSessionForChannel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns existing session when found', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 'whatsapp:15551234567',
      language: 'fr',
      userId: 'u-existing',
    });

    const result = await getOrCreateSessionForChannel({
      channel: 'whatsapp',
      channelUserId: '15551234567',
      userId: 'u-new',
    });

    expect(result.sessionId).toBe('whatsapp:15551234567');
    expect(result.userId).toBe('u-existing');
    expect(result.language).toBe('fr');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('creates session when none exists and returns defaults', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    mockCreateSession.mockResolvedValueOnce({ id: 'whatsapp:15551234567' });

    const result = await getOrCreateSessionForChannel({
      channel: 'whatsapp',
      channelUserId: '15551234567',
      userId: 'u1',
    });

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'whatsapp:15551234567',
        channel: 'whatsapp',
        language: 'en',
        userId: 'u1',
      }),
    );
    expect(result.sessionId).toBe('whatsapp:15551234567');
    expect(result.language).toBe('en');
    expect(result.userId).toBe('u1');
  });

  it('uses deterministic sessionId: {channel}:{channelUserId}', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    mockCreateSession.mockResolvedValueOnce({});

    const result = await getOrCreateSessionForChannel({
      channel: 'whatsapp',
      channelUserId: 'phone-abc',
    });

    expect(result.sessionId).toBe('whatsapp:phone-abc');
  });

  it('tolerates create failure (race condition) and still returns', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    mockCreateSession.mockRejectedValueOnce(new Error('Unique constraint violation'));

    const result = await getOrCreateSessionForChannel({
      channel: 'whatsapp',
      channelUserId: '15551234567',
    });

    expect(result.sessionId).toBe('whatsapp:15551234567');
  });

  it('works for instagram channel', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    mockCreateSession.mockResolvedValueOnce({});

    const result = await getOrCreateSessionForChannel({
      channel: 'instagram',
      channelUserId: 'psid-12345',
    });

    expect(result.sessionId).toBe('instagram:psid-12345');
  });
});
