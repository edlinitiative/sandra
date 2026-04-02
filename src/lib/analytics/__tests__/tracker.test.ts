import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────
// tracker.ts imports { db } from '@/lib/db' — mock the `db` named export.

const { mockCreate, mockDb, mockLog } = vi.hoisted(() => {
  const mockCreate = vi.fn().mockResolvedValue({ id: 'evt-1' });
  return {
    mockCreate,
    mockDb: { analyticsEvent: { create: mockCreate } },
    mockLog: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/utils', () => ({ createLogger: () => mockLog }));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('trackEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'evt-1' });
  });

  it('returns void synchronously (fire-and-forget)', async () => {
    const { trackEvent } = await import('@/lib/analytics/tracker');
    const result = trackEvent({
      eventType: 'session_started',
      sessionId: 'sess-1',
      userId: 'user-1',
      data: { channel: 'web', language: 'en', isNewSession: false },
    });
    expect(result).toBeUndefined();
  });

  it('writes the event to analyticsEvent.create', async () => {
    const { trackEvent } = await import('@/lib/analytics/tracker');
    trackEvent({
      eventType: 'message_sent',
      sessionId: 'sess-2',
      userId: 'user-2',
      channel: 'web',
      language: 'en',
      data: { messageLength: 42, channel: 'web', language: 'en' },
    });

    // Let the async microtask queue flush
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call?.data.eventType).toBe('message_sent');
    expect(call?.data.sessionId).toBe('sess-2');
    expect(call?.data.channel).toBe('web');
    expect(call?.data.language).toBe('en');
  });

  it('does NOT throw when analyticsEvent.create rejects', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB down'));
    const { trackEvent } = await import('@/lib/analytics/tracker');

    expect(() =>
      trackEvent({ eventType: 'cache_hit', data: { model: 'gpt-4o' } }),
    ).not.toThrow();

    // Wait for the rejected promise to settle silently
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should have attempted the write
    expect(mockCreate).toHaveBeenCalledOnce();
    // Should have logged the warning
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write'),
      expect.objectContaining({ eventType: 'cache_hit' }),
    );
  });

  it('supports all 6 event types without throwing', async () => {
    const { trackEvent } = await import('@/lib/analytics/tracker');
    const events: import('@/lib/analytics/types').AnalyticsEvent[] = [
      { eventType: 'session_started',     data: { channel: 'web', language: 'en', isNewSession: false } },
      { eventType: 'message_sent',        data: { messageLength: 10, channel: 'web', language: 'en' } },
      { eventType: 'tool_executed',       data: { toolName: 'searchKnowledge', latencyMs: 100, success: true } },
      { eventType: 'retrieval_completed', data: { query: 'test', resultsReturned: 3, topScore: 0.8, latencyMs: 50 } },
      { eventType: 'response_generated',  data: { latencyMs: 500, responseLength: 200, toolsUsed: [] as string[], model: 'gpt-4o' } },
      { eventType: 'cache_hit',           data: { model: 'gpt-4o' } },
    ];

    for (const event of events) {
      expect(() => trackEvent(event)).not.toThrow();
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockCreate).toHaveBeenCalledTimes(events.length);
  });
});
