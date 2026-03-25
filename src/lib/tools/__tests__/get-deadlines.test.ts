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
  contact: string;
};

type DeadlineData = {
  deadlines: DeadlineEntry[];
  total: number;
  summary: { alwaysOpen: number; seasonalDeadlines: number; pendingAnnouncement: number };
  tip: string;
  applicationHub: string;
  note: string;
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

  it('returns all 5 programs when openOnly=false (default)', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    expect(data.total).toBe(5);
  });

  it('openOnly=true returns only programs with status=open', async () => {
    const result = await getProgramDeadlines.handler({ openOnly: true }, ctx);
    const data = result.data as DeadlineData;
    for (const d of data.deadlines) {
      expect(d.status).toBe('open');
    }
    // Academy, Code, Labs are always open
    expect(data.total).toBe(3);
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

  it('provides a summary with always-open, seasonal, and pending counts', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    expect(typeof data.summary.alwaysOpen).toBe('number');
    expect(typeof data.summary.seasonalDeadlines).toBe('number');
    expect(typeof data.summary.pendingAnnouncement).toBe('number');
    expect(data.summary.alwaysOpen + data.summary.seasonalDeadlines + data.summary.pendingAnnouncement).toBe(data.total);
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

  it('includes contact info for each deadline entry', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    for (const d of data.deadlines) {
      expect(d.contact).toContain('@edlight.org');
    }
  });
});

describe('getProgramDeadlines tool — type filter', () => {
  it('returns only leadership deadlines when type=leadership', async () => {
    const result = await getProgramDeadlines.handler({ type: 'leadership' }, ctx);
    const data = result.data as DeadlineData;
    expect(data.total).toBe(1);
    for (const d of data.deadlines) {
      expect(d.type).toBe('leadership');
    }
  });

  it('returns only exchange deadlines when type=exchange', async () => {
    const result = await getProgramDeadlines.handler({ type: 'exchange' }, ctx);
    const data = result.data as DeadlineData;
    expect(data.total).toBe(1);
    for (const d of data.deadlines) {
      expect(d.type).toBe('exchange');
    }
  });

  it('has no scholarship type — EdLight does not offer scholarships', async () => {
    const result = await getProgramDeadlines.handler({ type: 'all' }, ctx);
    const data = result.data as DeadlineData;
    const types = new Set(data.deadlines.map((d) => d.type));
    expect(types.has('scholarship')).toBe(false);
  });

  it('has no internship type — EdLight has no internship programs', async () => {
    const result = await getProgramDeadlines.handler({ type: 'all' }, ctx);
    const data = result.data as DeadlineData;
    const types = new Set(data.deadlines.map((d) => d.type));
    expect(types.has('internship')).toBe(false);
  });

  it('covers all 5 program types', async () => {
    const result = await getProgramDeadlines.handler({ type: 'all' }, ctx);
    const data = result.data as DeadlineData;
    const types = new Set(data.deadlines.map((d) => d.type));
    expect(types.has('leadership')).toBe(true);
    expect(types.has('exchange')).toBe(true);
    expect(types.has('education')).toBe(true);
    expect(types.has('coding')).toBe(true);
    expect(types.has('innovation')).toBe(true);
  });
});

describe('getProgramDeadlines tool — ordering', () => {
  it('deadlines with specific dates appear before those without', async () => {
    const result = await getProgramDeadlines.handler({}, ctx);
    const data = result.data as DeadlineData;
    const firstNullIdx = data.deadlines.findIndex((d) => d.deadlineDate === null);
    const lastDateIdx = [...data.deadlines].reverse().findIndex((d) => d.deadlineDate !== null);
    const lastDateIdxFromStart = lastDateIdx === -1 ? -1 : data.deadlines.length - 1 - lastDateIdx;
    // If both dated and undated exist, all dated must appear before all undated
    if (firstNullIdx !== -1 && lastDateIdxFromStart !== -1) {
      expect(lastDateIdxFromStart).toBeLessThan(firstNullIdx);
    }
  });
});
