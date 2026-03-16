/**
 * V2 Phase 3 — Grounded Platform Knowledge Benchmark Tests
 *
 * Validates that Sandra returns grounded, tool-backed, platform-specific
 * answers for the four benchmark prompts from the phase document:
 *
 *   1. "What is EdLight?"            → getEdLightInitiatives (all platforms)
 *   2. "What courses on Academy?"    → getCourseInventory platform='academy'
 *   3. "What courses on Code?"       → getCourseInventory platform='code'
 *   4. "What does Initiative do?"    → getEdLightInitiatives category='leadership'
 *
 * These tests verify:
 *   - Tools return grounded data (actual names, descriptions, highlights)
 *   - Platform differentiation (Academy ≠ Code ≠ News ≠ Initiative)
 *   - System prompts encode the correct routing for all 4 benchmark scenarios
 *   - No generic summaries — answers must contain specific platform/course names
 */

import { describe, it, expect } from 'vitest';
import { getCourseInventory } from '@/lib/tools/get-courses';
import { getEdLightInitiatives } from '@/lib/tools/get-initiatives';
import { buildSandraSystemPrompt, getSandraSystemPrompt } from '../prompts';
import type { ToolContext } from '@/lib/tools/types';

// ---------------------------------------------------------------------------
// Shared context
// ---------------------------------------------------------------------------

const ctx: ToolContext = {
  sessionId: 'sess_p3_test',
  scopes: ['knowledge:read', 'repos:read'],
};

type Initiative = {
  name: string;
  category: string;
  description: string;
  focus: string;
  highlights: string[];
};

type InitiativeData = {
  initiatives: Initiative[];
  totalPlatforms: number;
};

type Course = {
  title: string;
  platform: string;
  level: string;
  description: string;
  url: string;
};

type CourseData = {
  platform: string;
  platformContext: string;
  courses: Course[];
  totalCourses: number;
};

// ---------------------------------------------------------------------------
// Benchmark 1: "What is EdLight?" → getEdLightInitiatives (all 4 platforms)
// ---------------------------------------------------------------------------

describe('Benchmark 1 — "What is EdLight?" → grounded platform overview', () => {
  it('returns all 4 platforms with grounded descriptions', async () => {
    const result = await getEdLightInitiatives.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as InitiativeData;
    expect(data.initiatives).toHaveLength(4);
  });

  it('each platform has a non-generic description', async () => {
    const result = await getEdLightInitiatives.handler({}, ctx);
    const data = result.data as InitiativeData;
    for (const initiative of data.initiatives) {
      // Description must be more than a generic title blurb
      expect(initiative.description.length).toBeGreaterThan(60);
      expect(initiative.description).toBeTruthy();
    }
  });

  it('each platform has a focus field that distinguishes it', async () => {
    const result = await getEdLightInitiatives.handler({}, ctx);
    const data = result.data as InitiativeData;
    const focuses = data.initiatives.map((i) => i.focus);
    // All 4 focus values should be distinct
    const uniqueFocuses = new Set(focuses);
    expect(uniqueFocuses.size).toBe(4);
  });

  it('each platform has highlights with specific named features', async () => {
    const result = await getEdLightInitiatives.handler({}, ctx);
    const data = result.data as InitiativeData;
    for (const initiative of data.initiatives) {
      expect(initiative.highlights).toBeInstanceOf(Array);
      expect(initiative.highlights.length).toBeGreaterThan(0);
      expect(initiative.highlights[0]).toBeTruthy();
    }
  });

  it('system prompt routes "What is EdLight?" to getEdLightInitiatives', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    // Prompt must mention "What is EdLight?" → getEdLightInitiatives
    expect(prompt).toContain('getEdLightInitiatives');
    expect(prompt.toLowerCase()).toMatch(/what is edlight|ecosystem overview|all.*platform/i);
  });
});

// ---------------------------------------------------------------------------
// Benchmark 2: "What courses on Academy?" → getCourseInventory platform='academy'
// ---------------------------------------------------------------------------

describe('Benchmark 2 — "What courses on Academy?" → grounded Academy course list', () => {
  it('returns Academy courses with actual course titles', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as CourseData;
    expect(data.courses.length).toBeGreaterThanOrEqual(5);
  });

  it('includes named courses — not just generic descriptions', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title);
    // Must include named courses, not generic placeholders
    expect(titles.some((t) => /math|physics|economics|leadership|exam/i.test(t))).toBe(true);
    expect(titles.some((t) => /math|physics|economics/i.test(t))).toBe(true);
    expect(titles.some((t) => /leadership|exam/i.test(t))).toBe(true);
    expect(titles.some((t) => /math|physics|economics|leadership|exam/i.test(t))).toBe(true);
  });

  it('includes platform context describing Academy focus', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    const data = result.data as CourseData;
    expect(data.platformContext).toBeTruthy();
    expect(data.platformContext.toLowerCase()).toMatch(/academy|digital literacy|productivity/);
  });

  it('each Academy course has a URL field', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    const data = result.data as CourseData;
    for (const course of data.courses) {
      expect(course.url).toBeTruthy();
      expect(course.url).toContain('edlight.org/academy');
    }
  });

  it('all returned courses are Academy courses', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    const data = result.data as CourseData;
    expect(data.courses.every((c) => c.platform === 'academy')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Benchmark 3: "What courses on Code?" → getCourseInventory platform='code'
// ---------------------------------------------------------------------------

describe('Benchmark 3 — "What courses on Code?" → grounded Code course list', () => {
  it('returns Code courses with actual course titles', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as CourseData;
    expect(data.courses.length).toBeGreaterThanOrEqual(5);
  });

  it('includes named coding courses — not just generic descriptions', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title);
    expect(titles.some((t) => /python/i.test(t))).toBe(true);
    expect(titles.some((t) => /sql/i.test(t))).toBe(true);
    expect(titles.some((t) => /web development/i.test(t))).toBe(true);
    expect(titles.some((t) => /coding|beginner/i.test(t))).toBe(true);
  });

  it('includes platform context describing Code focus', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    expect(data.platformContext).toBeTruthy();
    expect(data.platformContext.toLowerCase()).toMatch(/code|coding|programming/);
  });

  it('each Code course has a URL field', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    for (const course of data.courses) {
      expect(course.url).toBeTruthy();
      // Code courses link to edlinitiative/code repo
      expect(course.url).toContain('edlinitiative/code');
    }
  });

  it('all returned courses are Code courses', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    expect(data.courses.every((c) => c.platform === 'code')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Benchmark 4: "What does EdLight Initiative do?" → grounded Initiative answer
// ---------------------------------------------------------------------------

describe('Benchmark 4 — "What does EdLight Initiative do?" → grounded Initiative answer', () => {
  it('returns Initiative data with category=leadership filter', async () => {
    const result = await getEdLightInitiatives.handler({ category: 'leadership' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as InitiativeData;
    expect(data.initiatives).toHaveLength(1);
    expect(data.initiatives[0]?.name).toBe('EdLight Initiative');
  });

  it('Initiative description mentions leadership and community programs', async () => {
    const result = await getEdLightInitiatives.handler({ category: 'leadership' }, ctx);
    const data = result.data as InitiativeData;
    const desc = data.initiatives[0]?.description ?? '';
    expect(desc.toLowerCase()).toMatch(/leadership|community|mission|organization/);
  });

  it('Initiative highlights include specific programs', async () => {
    const result = await getEdLightInitiatives.handler({ category: 'leadership' }, ctx);
    const data = result.data as InitiativeData;
    const highlights = data.initiatives[0]?.highlights ?? [];
    expect(highlights.length).toBeGreaterThan(0);
    // At least one highlight should mention leadership or community
    expect(highlights.some((h) => /leadership|community|mission/i.test(h))).toBe(true);
  });

  it('system prompt routes Initiative questions to getEdLightInitiatives', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    // Prompt should map "What does EdLight Initiative do?" → getEdLightInitiatives
    expect(prompt).toContain('getEdLightInitiatives');
    expect(prompt.toLowerCase()).toMatch(/initiative.*leadership|leadership.*initiative/i);
  });

  it('getSandraSystemPrompt also routes Initiative questions correctly', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    expect(prompt).toContain('getEdLightInitiatives');
    expect(prompt.toLowerCase()).toMatch(/initiative|leadership/i);
  });
});

// ---------------------------------------------------------------------------
// Platform Differentiation Tests (V2-P3-C)
// ---------------------------------------------------------------------------

describe('Platform differentiation — Academy vs Code vs News vs Initiative', () => {
  it('Academy and Code serve different domains (digital literacy vs coding)', async () => {
    const [academyResult, codeResult] = await Promise.all([
      getEdLightInitiatives.handler({ category: 'education' }, ctx),
      getEdLightInitiatives.handler({ category: 'coding' }, ctx),
    ]);
    const academyData = academyResult.data as InitiativeData;
    const codeData = codeResult.data as InitiativeData;

    const academyFocus = academyData.initiatives[0]?.focus ?? '';
    const codeFocus = codeData.initiatives[0]?.focus ?? '';

    expect(academyFocus).not.toBe(codeFocus);
    expect(academyFocus.toLowerCase()).toMatch(/academic|student|exam|education/);
    expect(codeFocus.toLowerCase()).toMatch(/coding|programming/);
  });

  it('News and Initiative serve different purposes (news vs leadership)', async () => {
    const [newsResult, initiativeResult] = await Promise.all([
      getEdLightInitiatives.handler({ category: 'news' }, ctx),
      getEdLightInitiatives.handler({ category: 'leadership' }, ctx),
    ]);
    const newsData = newsResult.data as InitiativeData;
    const initData = initiativeResult.data as InitiativeData;

    const newsFocus = newsData.initiatives[0]?.focus ?? '';
    const initFocus = initData.initiatives[0]?.focus ?? '';

    expect(newsFocus).not.toBe(initFocus);
    expect(newsFocus.toLowerCase()).toMatch(/news|announcement/);
    expect(initFocus.toLowerCase()).toMatch(/leadership|organization|community/);
  });

  it('Academy courses are distinct from Code courses', async () => {
    const [academyResult, codeResult] = await Promise.all([
      getCourseInventory.handler({ platform: 'academy' }, ctx),
      getCourseInventory.handler({ platform: 'code' }, ctx),
    ]);
    const academyData = academyResult.data as CourseData;
    const codeData = codeResult.data as CourseData;

    const academyTitles = new Set(academyData.courses.map((c) => c.title));
    const codeTitles = new Set(codeData.courses.map((c) => c.title));

    // No overlap between Academy and Code course titles
    for (const title of codeTitles) {
      expect(academyTitles.has(title)).toBe(false);
    }
  });

  it('system prompt explicitly differentiates all 4 platforms', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt.toLowerCase()).toContain('academy');
    expect(prompt.toLowerCase()).toContain('edlight code');
    expect(prompt.toLowerCase()).toContain('news');
    expect(prompt.toLowerCase()).toContain('initiative');
    // Must explain that News and Initiative don't have courses
    expect(prompt.toLowerCase()).toMatch(/news.*not.*course|initiative.*not.*course|do not.*news.*course/i);
  });

  it('system prompt clarifies Academy vs Code distinction', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    // Academy = digital literacy/productivity; Code = programming/coding
    expect(prompt.toLowerCase()).toMatch(/academy.*academic|academy.*student|academy.*exam|academic.*academy/i);
    expect(prompt.toLowerCase()).toMatch(/code.*coding|code.*programming|coding.*code/i);
  });
});
