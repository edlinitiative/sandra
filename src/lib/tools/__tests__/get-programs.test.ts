import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockSearchPlatformKnowledge,
  mockExtractProgramMatches,
  mockListGroundingSources,
  mockExtractHighlights,
} = vi.hoisted(() => ({
  mockSearchPlatformKnowledge: vi.fn(),
  mockExtractProgramMatches: vi.fn(),
  mockListGroundingSources: vi.fn(),
  mockExtractHighlights: vi.fn(),
}));

vi.mock('@/lib/knowledge', () => ({
  searchPlatformKnowledge: mockSearchPlatformKnowledge,
  extractProgramMatches: mockExtractProgramMatches,
  listGroundingSources: mockListGroundingSources,
  extractHighlights: mockExtractHighlights,
}));

import { getProgramsAndScholarships } from '../get-programs';
import type { ToolContext } from '../types';

const ctx: ToolContext = {
  sessionId: 'sess_program_test',
  scopes: ['knowledge:read'],
};

type ProgramData = {
  programs: Array<{
    name: string;
    type: string;
    sourcePath?: string;
    applicationUrl: string;
  }>;
  total: number;
  types: string[];
  grounding: string;
  groundingSources: string[];
  highlights: string[];
};

describe('getProgramsAndScholarships tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchPlatformKnowledge.mockResolvedValue([]);
    mockExtractProgramMatches.mockReturnValue([]);
    mockListGroundingSources.mockReturnValue([]);
    mockExtractHighlights.mockReturnValue([]);
  });

  it('has correct metadata', () => {
    expect(getProgramsAndScholarships.name).toBe('getProgramsAndScholarships');
    expect(getProgramsAndScholarships.requiredScopes).toContain('knowledge:read');
  });

  it('returns fallback programs when indexed knowledge is unavailable', async () => {
    const result = await getProgramsAndScholarships.handler({}, ctx);
    expect(result.success).toBe(true);

    const data = result.data as ProgramData;
    expect(data.grounding).toBe('fallback');
    expect(data.total).toBeGreaterThan(0);
    expect(data.programs.some((program) => /ESLP|Summer Leadership/i.test(program.name))).toBe(true);
    // EdLight does NOT offer its own scholarships — no scholarship entries expected
    expect(data.programs.some((program) => /Scholarship|Award/i.test(program.name))).toBe(false);
  });

  it('filters fallback programs by type — leadership returns only ESLP', async () => {
    const result = await getProgramsAndScholarships.handler({ type: 'leadership' }, ctx);
    const data = result.data as ProgramData;

    expect(data.total).toBe(1);
    expect(data.types).toEqual(['leadership']);
    expect(data.programs.every((program) => program.type === 'leadership')).toBe(true);
    expect(data.programs[0]?.name).toMatch(/ESLP|Summer Leadership/i);
  });

  it('surfaces indexed grounding data when a known program is found in repo knowledge', async () => {
    mockSearchPlatformKnowledge.mockResolvedValue([
      {
        chunk: {
          sourceId: 'edlinitiative/EdLight-Initiative',
          title: 'ESLP',
          path: 'docs/programs/eslp.md',
          content: 'EdLight Summer Leadership Program (ESLP) leadership workshops and mentorship',
          chunkIndex: 0,
          chunkTotal: 1,
          contentHash: 'hash-eslp',
          metadata: { platform: 'initiative', contentType: 'program' },
        },
        score: 0.92,
      },
    ]);
    mockExtractProgramMatches.mockReturnValue([
      {
        name: 'EdLight Summer Leadership Program (ESLP)',
        type: 'leadership',
        description: 'Grounded leadership experience with mentorship and community projects.',
        path: 'docs/programs/eslp.md',
      },
    ]);
    mockListGroundingSources.mockReturnValue(['docs/programs/eslp.md']);
    mockExtractHighlights.mockReturnValue(['Leadership workshops', 'Mentorship']);

    const result = await getProgramsAndScholarships.handler({ type: 'leadership' }, ctx);
    const data = result.data as ProgramData;

    expect(data.grounding).toBe('indexed');
    expect(data.total).toBe(1);
    expect(data.groundingSources).toEqual(['docs/programs/eslp.md']);
    expect(data.highlights).toEqual(['Leadership workshops', 'Mentorship']);
    expect(data.programs[0]?.name).toBe('EdLight Summer Leadership Program (ESLP)');
    expect(data.programs[0]?.sourcePath).toBe('docs/programs/eslp.md');
    expect(data.programs[0]?.applicationUrl).toBeTruthy();
  });
});
