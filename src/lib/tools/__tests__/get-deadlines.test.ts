import { describe, it, expect } from 'vitest';
import { getProgramDeadlines } from '../get-deadlines';
import type { ToolContext } from '../types';

const ctx: ToolContext = {
  sessionId: 'sess_deadlines_test',
  scopes: ['knowledge:read'],
};

type DeadlineEntry = {
  program: string;
  type: string;
  status: string;
  deadline: string;
  deadlineDate: string | null;
  cost: string;
  applicationUrl: string;
  urgency: string;
};

type DeadlineData = {
  deadlines: DeadlineEntry[];
  total: number;
  summary: { rollingApplications: number; seasonalDeadlines: number };
  tip: string;
  applicationHub: string;
};

describe('getProgramDeadlines tool — metadata', () => {
  it('has the correct name', () => {
    expect(getProgramDeadlines.name).toBe('getProgramDeadlines');
  });

  it('requires knowledge:read scope', () => {
    expect(getProgramDeadlines.requiredScopes).toContain('knowledge:read');
  });

  it('description mentions deadlines and applications', () => {
    expect(getProgramDeadlines.description.toLowerCase()).toContain('deadline');
    expect(getProgramDeadlines.description.toLowerCase()).toContain('appl');
  });
});

describe('getProgramDeadlines tool — all programs', () => {
  it('returns deadlines successfully', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as DeadlineData;
    expect(data.deadlines.length).toBeGreaterThan(0);
    expect(data.total).toBe(data.deadlines.length);
  });

  it('default openOnly=true excludes closed programs', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    for (const d of data.deadlines) {
      expect(d.status).not.toBe('closed');
    }
  });

  it('includes ESLP in the results', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    expect(data.deadlines.some((d) => /ESLP|Summer Leadership/i.test(d.program))).toBe(true);
  });

  it('does not include any scholarship deadlines (EdLight has no internal scholarships)', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    expect(data.deadlines.some((d) => /Scholarship|Award/i.test(d.program))).toBe(false);
  });

  it('provides a summary with rolling and seasonal counts', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    expect(typeof data.summary.rollingApplications).toBe('number');
    expect(typeof data.summary.seasonalDeadlines).toBe('number');
    expect(data.summary.rollingApplications + data.summary.seasonalDeadlines).toBe(data.total);
  });

  it('provides a helpful tip string', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    expect(data.tip).toBeTruthy();
    expect(typeof data.tip).toBe('string');
  });

  it('provides an applicationHub URL', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    expect(data.applicationHub).toMatch(/^https?:\/\//);
  });
});

describe('getProgramDeadlines tool — type filter', () => {
  it('returns only leadership deadlines when type=leadership', async () => {
    const result = await getProgramDeadlines.handler({ type: 'leadership' }, ctx);
    const data = result.data as DeadlineData;
    expect(data.total).toBeGreaterThan(0);
    for (const d of data.deadlines) {
      expect(d.type).toBe('leadership');
    }
  });

  it('has no scholarship type — scholarship is not a valid filter', async () => {
    // EdLight does not offer its own scholarships; 'scholarship' is no longer a valid type
    const result = await getProgramDeadlines.handler({ type: 'all' }, ctx);
    const data = result.data as DeadlineData;
    const types = new Set(data.deadlines.map((d) => d.type));
    expect(types.has('scholarship')).toBe(false);
  });

  it('has no internship type — EdLight has no internship programs', async () => {
    // EdLight only has ESLP (leadership); no internships exist
    const result = await getProgramDeadlines.handler({ type: 'all' }, ctx);
    const data = result.data as DeadlineData;
    const types = new Set(data.deadlines.map((d) => d.type));
    expect(types.has('internship')).toBe(false);
    expect(types.has('leadership')).toBe(true);
  });
});

describe('getProgramDeadlines tool — ordering', () => {
  it('seasonal deadlines (with a specific date) appear before rolling ones', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    const firstRollingIdx = data.deadlines.findIndex((d) => d.urgency === 'rolling');
    const lastSeasonalIdx = [...data.deadlines].reverse().findIndex((d) => d.urgency === 'seasonal');
    const lastSeasonalIdxFromStart = lastSeasonalIdx === -1 ? -1 : data.deadlines.length - 1 - lastSeasonalIdx;
    // If both seasonal and rolling exist, all seasonals must appear before all rolling
    if (firstRollingIdx !== -1 && lastSeasonalIdxFromStart !== -1) {
      expect(lastSeasonalIdxFromStart).toBeLessThan(firstRollingIdx);
    }
  });
});
