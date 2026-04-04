/**
 * Tests for the feedback service (src/lib/feedback/index.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockFindFirst = vi.fn();
const mockCreate = vi.fn().mockResolvedValue({});
const mockCount = vi.fn();
const mockFindMany = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    messageFeedback: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      create: (...a: unknown[]) => mockCreate(...a),
      count: (...a: unknown[]) => mockCount(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
  },
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: (...a: unknown[]) => mockTrackEvent(...a),
}));

import { submitFeedback, getFeedbackStats } from '../index';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseParams = {
  sessionId: 'sess-1',
  userId: 'user-1',
  messageRef: 'msg-uuid-123',
  rating: 'up' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFirst.mockResolvedValue(null); // no duplicate by default
  mockCreate.mockResolvedValue({});
});

// ─── submitFeedback ───────────────────────────────────────────────────────────

describe('submitFeedback', () => {
  it('writes feedback to DB', async () => {
    await submitFeedback(baseParams);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'sess-1',
          messageRef: 'msg-uuid-123',
          rating: 'up',
        }),
      }),
    );
  });

  it('fires a response_feedback analytics event', async () => {
    await submitFeedback(baseParams);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'response_feedback',
        sessionId: 'sess-1',
        data: expect.objectContaining({ rating: 'up', hasComment: false }),
      }),
    );
  });

  it('sets hasComment=true when comment provided', async () => {
    await submitFeedback({ ...baseParams, comment: 'Very helpful!' });
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasComment: true }),
      }),
    );
  });

  it('ignores duplicate vote on same message', async () => {
    mockFindFirst.mockResolvedValue({ id: 'existing-1' });
    await submitFeedback(baseParams);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('works for thumbs-down', async () => {
    await submitFeedback({ ...baseParams, rating: 'down' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rating: 'down' }) }),
    );
  });

  it('throws on invalid rating', async () => {
    await expect(
      submitFeedback({ ...baseParams, rating: 'sideways' as 'up' }),
    ).rejects.toThrow();
  });

  it('works without userId (anonymous)', async () => {
    const anonParams = { sessionId: 'sess-anon', messageRef: 'msg-1', rating: 'up' as const };
    await submitFeedback(anonParams);
    expect(mockCreate).toHaveBeenCalled();
  });
});

// ─── getFeedbackStats ─────────────────────────────────────────────────────────

describe('getFeedbackStats', () => {
  beforeEach(() => {
    mockCount
      .mockResolvedValueOnce(10)   // total
      .mockResolvedValueOnce(8);   // positive
    mockFindMany.mockResolvedValue([
      { sessionId: 'sess-bad', comment: 'Not useful', createdAt: new Date() },
    ]);
  });

  it('returns total, positive, and negative counts', async () => {
    const stats = await getFeedbackStats();
    expect(stats.total).toBe(10);
    expect(stats.positive).toBe(8);
    expect(stats.negative).toBe(2);
  });

  it('computes satisfactionRate as a fraction 0–1', async () => {
    const stats = await getFeedbackStats();
    expect(stats.satisfactionRate).toBe(0.8);
  });

  it('includes recentNegative with sessionId and comment', async () => {
    const stats = await getFeedbackStats();
    expect(stats.recentNegative).toHaveLength(1);
    expect(stats.recentNegative[0]?.sessionId).toBe('sess-bad');
    expect(stats.recentNegative[0]?.comment).toBe('Not useful');
  });

  it('returns satisfactionRate=null when total is 0', async () => {
    vi.resetAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);
    const stats = await getFeedbackStats();
    expect(stats.satisfactionRate).toBeNull();
    expect(stats.total).toBe(0);
  });

  it('includes period in response', async () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-07');
    const stats = await getFeedbackStats(from, to);
    expect(stats.period.from).toEqual(from);
    expect(stats.period.to).toEqual(to);
  });
});
