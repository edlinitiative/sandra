import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockSearchPlatformKnowledge, mockExtractHighlights, mockListGroundingSources } =
  vi.hoisted(() => ({
    mockSearchPlatformKnowledge: vi.fn(),
    mockExtractHighlights: vi.fn(),
    mockListGroundingSources: vi.fn(),
  }));

vi.mock('@/lib/knowledge', () => ({
  searchPlatformKnowledge: mockSearchPlatformKnowledge,
  extractHighlights: mockExtractHighlights,
  listGroundingSources: mockListGroundingSources,
}));

import { getLatestNews } from '../get-latest-news';
import type { ToolContext } from '../types';

const ctx: ToolContext = {
  sessionId: 'sess_news_test',
  scopes: ['knowledge:read'],
};

type NewsItem = {
  title: string;
  category: string;
  summary: string;
  date: string;
  url: string;
  tags: string[];
};

type NewsData = {
  items: NewsItem[];
  total: number;
  category: string;
  grounding: string;
  groundingSources: string[];
  highlights?: string[];
  note?: string;
};

describe('getLatestNews tool — metadata', () => {
  it('has the correct name', () => {
    expect(getLatestNews.name).toBe('getLatestNews');
  });

  it('requires knowledge:read scope', () => {
    expect(getLatestNews.requiredScopes).toContain('knowledge:read');
  });

  it('description mentions news and announcements', () => {
    expect(getLatestNews.description.toLowerCase()).toContain('news');
    expect(getLatestNews.description.toLowerCase()).toContain('announc');
  });
});

describe('getLatestNews tool — fallback data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchPlatformKnowledge.mockResolvedValue([]);
    mockExtractHighlights.mockReturnValue([]);
    mockListGroundingSources.mockReturnValue([]);
  });

  it('returns fallback items when knowledge index is empty', async () => {
    const result = await getLatestNews.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as NewsData;
    expect(data.grounding).toBe('fallback');
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.total).toBeGreaterThan(0);
  });

  it('includes a note about fallback mode', async () => {
    const result = await getLatestNews.handler({}, ctx);
    const data = result.data as NewsData;
    expect(data.note).toBeTruthy();
  });

  it('items are sorted newest first', async () => {
    const result = await getLatestNews.handler({}, ctx);
    const data = result.data as NewsData;
    for (let i = 1; i < data.items.length; i++) {
      expect(data.items[i - 1]!.date >= data.items[i]!.date).toBe(true);
    }
  });

  it('items include required fields', async () => {
    const result = await getLatestNews.handler({}, ctx);
    const data = result.data as NewsData;
    for (const item of data.items) {
      expect(item.title).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.summary).toBeTruthy();
      expect(item.date).toBeTruthy();
      expect(item.url).toBeTruthy();
      expect(Array.isArray(item.tags)).toBe(true);
    }
  });

  it('covers program and announcement categories', async () => {
    const result = await getLatestNews.handler({}, ctx);
    const data = result.data as NewsData;
    const categories = new Set(data.items.map((i) => i.category));
    expect(categories.has('program') || categories.has('announcement')).toBe(true);
  });
});

describe('getLatestNews tool — category filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchPlatformKnowledge.mockResolvedValue([]);
    mockExtractHighlights.mockReturnValue([]);
    mockListGroundingSources.mockReturnValue([]);
  });

  it('returns only program items when category=program', async () => {
    const result = await getLatestNews.handler({ category: 'program' }, ctx);
    const data = result.data as NewsData;
    expect(data.category).toBe('program');
    for (const item of data.items) {
      expect(item.category).toBe('program');
    }
  });

  it('returns only announcement items when category=announcement', async () => {
    const result = await getLatestNews.handler({ category: 'announcement' }, ctx);
    const data = result.data as NewsData;
    for (const item of data.items) {
      expect(item.category).toBe('announcement');
    }
  });

  it('respects the limit parameter', async () => {
    const result = await getLatestNews.handler({ limit: 2 }, ctx);
    const data = result.data as NewsData;
    expect(data.items.length).toBeLessThanOrEqual(2);
  });
});

describe('getLatestNews tool — indexed grounding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractHighlights.mockReturnValue(['ESLP 2026 applications are open']);
    mockListGroundingSources.mockReturnValue(['edlinitiative/EdLight-News']);
  });

  it('reports indexed grounding when knowledge results are available', async () => {
    mockSearchPlatformKnowledge.mockResolvedValue([
      {
        chunk: {
          sourceId: 'edlinitiative/EdLight-News',
          title: 'ESLP Open',
          path: 'news/eslp-2026.md',
          content: 'ESLP 2026 applications are open',
          chunkIndex: 0,
          chunkTotal: 1,
          contentHash: 'hash-news',
          metadata: { platform: 'news', contentType: 'news' },
        },
        score: 0.88,
      },
    ]);

    const result = await getLatestNews.handler({}, ctx);
    const data = result.data as NewsData;
    expect(data.grounding).toBe('indexed');
    expect(data.groundingSources).toContain('edlinitiative/EdLight-News');
  });
});
