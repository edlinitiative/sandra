import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserMemoryEntry } from '@/lib/memory/types';
import type { SearchResult } from '@/lib/knowledge/types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const { mockGetMemories, mockRetrieveContext, mockLog } = vi.hoisted(() => ({
  mockGetMemories:    vi.fn(),
  mockRetrieveContext: vi.fn(),
  mockLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({ getMemories: mockGetMemories }),
}));

vi.mock('@/lib/knowledge/retrieval', () => ({
  retrieveContext: mockRetrieveContext,
  rerankResults:  (r: unknown) => r, // passthrough
}));

vi.mock('@/lib/utils', () => ({ createLogger: () => mockLog }));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = new Date();

function makeMemoryEntry(key: string, value: string): UserMemoryEntry {
  return { key, value, source: 'conversation', confidence: 0.9, updatedAt: NOW };
}

function makeCourseResult(title: string, score = 0.8): SearchResult {
  return {
    score,
    chunk: {
      title,
      sourceId: 'src-1',
      content: `Learn ${title} in our structured course program.`,
      chunkIndex: 0,
      chunkTotal: 1,
      contentHash: 'abc',
      metadata: { platform: 'academy', contentType: 'course' },
    },
  };
}

function makeProgramResult(title: string, score = 0.75): SearchResult {
  return {
    score,
    chunk: {
      title,
      sourceId: 'src-2',
      content: `Join our leadership exchange program: ${title}.`,
      chunkIndex: 0,
      chunkTotal: 1,
      contentHash: 'def',
      metadata: { platform: 'initiative', contentType: 'program' },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getPersonalizedRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns structured recommendation object', async () => {
    mockGetMemories.mockResolvedValue([
      makeMemoryEntry('learning_interests', 'mathematics'),
    ]);
    mockRetrieveContext.mockResolvedValue([makeCourseResult('Maths 101')]);

    const { getPersonalizedRecommendations } = await import('../recommendations');
    const result = await getPersonalizedRecommendations('user-1');

    expect(result).toHaveProperty('courses');
    expect(result).toHaveProperty('programs');
    expect(result).toHaveProperty('totalFound');
    expect(result).toHaveProperty('basedOn');
  });

  it('populates courses from academy/code results', async () => {
    mockGetMemories.mockResolvedValue([
      makeMemoryEntry('learning_interests', 'coding'),
    ]);
    mockRetrieveContext.mockResolvedValue([
      makeCourseResult('Python Basics', 0.9),
      makeCourseResult('SQL Intro', 0.8),
    ]);

    const { getPersonalizedRecommendations } = await import('../recommendations');
    const result = await getPersonalizedRecommendations('user-1');

    expect(result.courses.length).toBeGreaterThan(0);
    expect(result.courses[0]!.title).toBe('Python Basics');
    expect(result.courses[0]!.relevanceScore).toBe(0.9);
  });

  it('populates programs from initiative/labs results', async () => {
    mockGetMemories.mockResolvedValue([
      makeMemoryEntry('program_interests', 'leadership'),
    ]);
    mockRetrieveContext.mockResolvedValue([
      makeProgramResult('ESLP 2026', 0.85),
    ]);

    const { getPersonalizedRecommendations } = await import('../recommendations');
    const result = await getPersonalizedRecommendations('user-1');

    expect(result.programs.length).toBeGreaterThan(0);
    expect(result.programs[0]!.title).toBe('ESLP 2026');
  });

  it('includes the memory keys that influenced recommendations', async () => {
    mockGetMemories.mockResolvedValue([
      makeMemoryEntry('learning_interests', 'chemistry'),
      makeMemoryEntry('occupation', 'student'),
    ]);
    mockRetrieveContext.mockResolvedValue([makeCourseResult('Chemistry A1')]);

    const { getPersonalizedRecommendations } = await import('../recommendations');
    const result = await getPersonalizedRecommendations('user-1');

    expect(result.basedOn).toContain('learning_interests');
    expect(result.basedOn).toContain('occupation');
  });

  it('returns empty arrays when retrieval returns nothing', async () => {
    mockGetMemories.mockResolvedValue([]);
    mockRetrieveContext.mockResolvedValue([]);

    const { getPersonalizedRecommendations } = await import('../recommendations');
    const result = await getPersonalizedRecommendations('user-1');

    expect(result.courses).toHaveLength(0);
    expect(result.programs).toHaveLength(0);
    expect(result.totalFound).toBe(0);
  });

  it('caps courses at 5 and programs at 3', async () => {
    mockGetMemories.mockResolvedValue([
      makeMemoryEntry('learning_interests', 'math'),
    ]);
    mockRetrieveContext.mockResolvedValue([
      makeCourseResult('Course 1', 0.9),
      makeCourseResult('Course 2', 0.88),
      makeCourseResult('Course 3', 0.85),
      makeCourseResult('Course 4', 0.83),
      makeCourseResult('Course 5', 0.8),
      makeCourseResult('Course 6', 0.78),
      makeProgramResult('Program 1', 0.9),
      makeProgramResult('Program 2', 0.88),
      makeProgramResult('Program 3', 0.85),
      makeProgramResult('Program 4', 0.8),
    ]);

    const { getPersonalizedRecommendations } = await import('../recommendations');
    const result = await getPersonalizedRecommendations('user-1');

    expect(result.courses.length).toBeLessThanOrEqual(5);
    expect(result.programs.length).toBeLessThanOrEqual(3);
  });

  it('does not crash when retrieval throws', async () => {
    mockGetMemories.mockResolvedValue([
      makeMemoryEntry('learning_interests', 'science'),
    ]);
    mockRetrieveContext.mockRejectedValue(new Error('Vector store unavailable'));

    const { getPersonalizedRecommendations } = await import('../recommendations');
    const result = await getPersonalizedRecommendations('user-1');

    expect(result.courses).toHaveLength(0);
    expect(result.programs).toHaveLength(0);
  });

  it('uses explicit query when provided', async () => {
    mockGetMemories.mockResolvedValue([]);
    mockRetrieveContext.mockResolvedValue([makeCourseResult('History 101')]);

    const { getPersonalizedRecommendations } = await import('../recommendations');
    await getPersonalizedRecommendations('user-1', 'I want to study history');

    const [calledQuery] = mockRetrieveContext.mock.calls[0];
    expect(calledQuery).toContain('I want to study history');
  });

  it('deduplicates results with the same title', async () => {
    mockGetMemories.mockResolvedValue([]);
    mockRetrieveContext.mockResolvedValue([
      makeCourseResult('Python Basics', 0.9),
      makeCourseResult('Python Basics', 0.85), // duplicate
    ]);

    const { getPersonalizedRecommendations } = await import('../recommendations');
    const result = await getPersonalizedRecommendations('user-1', 'python');

    const pythonCourses = result.courses.filter((c) => c.title === 'Python Basics');
    expect(pythonCourses).toHaveLength(1);
  });

  it('builds reason from matching interest', async () => {
    mockGetMemories.mockResolvedValue([
      makeMemoryEntry('learning_interests', 'physics'),
    ]);
    mockRetrieveContext.mockResolvedValue([makeCourseResult('Physics C2')]);

    const { getPersonalizedRecommendations } = await import('../recommendations');
    const result = await getPersonalizedRecommendations('user-1');

    // A reason referencing the interest or platform should be present
    expect(result.courses[0]!.reason).toBeTruthy();
    expect(typeof result.courses[0]!.reason).toBe('string');
  });
});
