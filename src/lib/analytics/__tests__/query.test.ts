import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const {
  mockCount,
  mockGroupBy,
  mockQueryRaw,
} = vi.hoisted(() => ({
  mockCount:    vi.fn(),
  mockGroupBy:  vi.fn(),
  mockQueryRaw: vi.fn(),
}));

const mockPrisma = {
  analyticsEvent: { count: mockCount, groupBy: mockGroupBy },
  $queryRaw: mockQueryRaw,
};

vi.mock('@/lib/db', () => ({ db: mockPrisma }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FROM = new Date('2026-01-01T00:00:00Z');
const TO   = new Date('2026-01-07T23:59:59Z');

function setupSummaryMocks() {
  mockCount.mockResolvedValue(100);
  mockGroupBy.mockImplementation((args: { by: string[] }) => {
    if (args.by[0] === 'eventType') {
      return Promise.resolve([
        { eventType: 'message_sent',       _count: { id: 40 } },
        { eventType: 'tool_executed',      _count: { id: 30 } },
        { eventType: 'response_generated', _count: { id: 20 } },
        { eventType: 'session_started',    _count: { id: 10 } },
      ]);
    }
    if (args.by[0] === 'channel') {
      return Promise.resolve([
        { channel: 'web',       _count: { id: 60 } },
        { channel: 'whatsapp',  _count: { id: 40 } },
      ]);
    }
    if (args.by[0] === 'language') {
      return Promise.resolve([
        { language: 'en', _count: { id: 70 } },
        { language: 'fr', _count: { id: 30 } },
      ]);
    }
    return Promise.resolve([]);
  });

  // $queryRaw calls: tool stats, latency, cache responses, cache hits
  mockQueryRaw
    .mockResolvedValueOnce([{ tool: 'searchKnowledge', count: 25n }, { tool: 'getWeather', count: 5n }])
    .mockResolvedValueOnce([{ avg_latency: 1234.56 }])
    .mockResolvedValueOnce([{ count: 20n }])   // responses
    .mockResolvedValueOnce([{ count: 5n }]);   // cache hits
}

// ─── getAnalyticsSummary ─────────────────────────────────────────────────────

describe('getAnalyticsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSummaryMocks();
  });

  it('returns total event count', async () => {
    const { getAnalyticsSummary } = await import('../query');
    const result = await getAnalyticsSummary(FROM, TO);
    expect(result.totalEvents).toBe(100);
  });

  it('returns byEventType map', async () => {
    const { getAnalyticsSummary } = await import('../query');
    const result = await getAnalyticsSummary(FROM, TO);
    expect(result.byEventType['message_sent']).toBe(40);
    expect(result.byEventType['tool_executed']).toBe(30);
  });

  it('returns byChannel map', async () => {
    const { getAnalyticsSummary } = await import('../query');
    const result = await getAnalyticsSummary(FROM, TO);
    expect(result.byChannel['web']).toBe(60);
    expect(result.byChannel['whatsapp']).toBe(40);
  });

  it('returns byLanguage map', async () => {
    const { getAnalyticsSummary } = await import('../query');
    const result = await getAnalyticsSummary(FROM, TO);
    expect(result.byLanguage['en']).toBe(70);
    expect(result.byLanguage['fr']).toBe(30);
  });

  it('returns topTools from $queryRaw', async () => {
    const { getAnalyticsSummary } = await import('../query');
    const result = await getAnalyticsSummary(FROM, TO);
    expect(result.topTools[0]).toEqual({ tool: 'searchKnowledge', count: 25 });
    expect(result.topTools[1]).toEqual({ tool: 'getWeather', count: 5 });
  });

  it('returns averageResponseMs rounded', async () => {
    const { getAnalyticsSummary } = await import('../query');
    const result = await getAnalyticsSummary(FROM, TO);
    expect(result.averageResponseMs).toBe(1235);
  });

  it('returns cacheHitRate as a fraction', async () => {
    const { getAnalyticsSummary } = await import('../query');
    const result = await getAnalyticsSummary(FROM, TO);
    // 5 hits / 20 responses = 0.25
    expect(result.cacheHitRate).toBe(0.25);
  });

  it('returns the requested period', async () => {
    const { getAnalyticsSummary } = await import('../query');
    const result = await getAnalyticsSummary(FROM, TO);
    expect(result.period.from).toEqual(FROM);
    expect(result.period.to).toEqual(TO);
  });
});

// ─── getToolUsageStats ───────────────────────────────────────────────────────

describe('getToolUsageStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts bigint count to number', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ tool: 'searchKnowledge', count: 42n }]);
    const { getToolUsageStats } = await import('../query');
    const stats = await getToolUsageStats(FROM, TO);
    expect(stats[0]).toEqual({ tool: 'searchKnowledge', count: 42 });
  });

  it('returns empty array when no tool events', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    const { getToolUsageStats } = await import('../query');
    const stats = await getToolUsageStats(FROM, TO);
    expect(stats).toHaveLength(0);
  });
});

// ─── getAverageResponseLatency ───────────────────────────────────────────────

describe('getAverageResponseLatency', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns rounded average latency', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ avg_latency: 999.7 }]);
    const { getAverageResponseLatency } = await import('../query');
    const latency = await getAverageResponseLatency(FROM, TO);
    expect(latency).toBe(1000);
  });

  it('returns null when no response_generated events', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ avg_latency: null }]);
    const { getAverageResponseLatency } = await import('../query');
    const latency = await getAverageResponseLatency(FROM, TO);
    expect(latency).toBeNull();
  });
});

// ─── getCacheHitRate ─────────────────────────────────────────────────────────

describe('getCacheHitRate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no response events', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ count: 0n }]);
    const { getCacheHitRate } = await import('../query');
    const rate = await getCacheHitRate(FROM, TO);
    expect(rate).toBeNull();
  });

  it('returns 0.5 when half of responses are cache hits', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ count: 10n }])
      .mockResolvedValueOnce([{ count: 5n }]);
    const { getCacheHitRate } = await import('../query');
    const rate = await getCacheHitRate(FROM, TO);
    expect(rate).toBe(0.5);
  });

  it('returns 0 when no cache hits', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ count: 10n }])
      .mockResolvedValueOnce([{ count: 0n }]);
    const { getCacheHitRate } = await import('../query');
    const rate = await getCacheHitRate(FROM, TO);
    expect(rate).toBe(0);
  });
});
