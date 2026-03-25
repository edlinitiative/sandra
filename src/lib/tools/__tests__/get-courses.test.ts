import { describe, it, expect } from 'vitest';
import { getCourseInventory } from '../get-courses';
import type { ToolContext } from '../types';

const ctx: ToolContext = {
  sessionId: 'sess_test',
  scopes: ['knowledge:read'],
};

type Course = { title: string; platform: string; level: string; beginner: boolean; description: string };
type CourseData = {
  platform: string;
  courses: Course[];
  totalCourses: number;
  beginnerRecommendation: { title: string; platform: string; description: string } | null;
  note: string;
};

describe('getCourseInventory tool — metadata', () => {
  it('has correct name', () => {
    expect(getCourseInventory.name).toBe('getCourseInventory');
  });

  it('requires knowledge:read scope', () => {
    expect(getCourseInventory.requiredScopes).toContain('knowledge:read');
  });

  it('has a description that mentions courses and Academy and Code', () => {
    expect(getCourseInventory.description.toLowerCase()).toContain('course');
    expect(getCourseInventory.description.toLowerCase()).toContain('academy');
    expect(getCourseInventory.description.toLowerCase()).toContain('code');
  });

  it('description steers agent away from getEdLightInitiatives for course questions', () => {
    expect(getCourseInventory.description).toContain('getEdLightInitiatives');
  });
});

describe('getCourseInventory tool — EdLight Academy courses', () => {
  it('returns only academy courses when platform=academy', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as CourseData;
    expect(data.courses.every((c) => c.platform === 'academy')).toBe(true);
    expect(data.totalCourses).toBeGreaterThan(0);
  });

  it('includes Maths course for Academy', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('math'))).toBe(true);
  });

  it('includes Physics course for Academy', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('physics'))).toBe(true);
  });

  it('includes Chemistry course for Academy', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('chemistry'))).toBe(true);
  });

  it('includes Economics course for Academy', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('economics'))).toBe(true);
  });

  it('includes Languages & Communication course for Academy', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('language'))).toBe(true);
  });
});

describe('getCourseInventory tool — EdLight Code courses', () => {
  it('returns only code courses when platform=code', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as CourseData;
    expect(data.courses.every((c) => c.platform === 'code')).toBe(true);
    expect(data.totalCourses).toBeGreaterThan(0);
  });

  it('includes Python track for Code', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('python'))).toBe(true);
  });

  it('includes SQL track for Code', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('sql'))).toBe(true);
  });

  it('includes HTML track for Code', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('html'))).toBe(true);
  });

  it('includes CSS track for Code', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('css'))).toBe(true);
  });

  it('includes JavaScript track for Code', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('javascript'))).toBe(true);
  });

  it('includes Terminal & Git track for Code', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    const titles = data.courses.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('terminal') || t.includes('git'))).toBe(true);
  });

  it('has 6 tracks total for Code', async () => {
    const result = await getCourseInventory.handler({ platform: 'code' }, ctx);
    const data = result.data as CourseData;
    expect(data.totalCourses).toBe(6);
  });
});

describe('getCourseInventory tool — both platforms', () => {
  it('returns courses from both platforms when platform=both', async () => {
    const result = await getCourseInventory.handler({ platform: 'both' }, ctx);
    const data = result.data as CourseData;
    const platforms = new Set(data.courses.map((c) => c.platform));
    expect(platforms.has('academy')).toBe(true);
    expect(platforms.has('code')).toBe(true);
  });

  it('defaults to both platforms when no platform specified', async () => {
    const result = await getCourseInventory.handler({}, ctx);
    const data = result.data as CourseData;
    const platforms = new Set(data.courses.map((c) => c.platform));
    expect(platforms.has('academy')).toBe(true);
    expect(platforms.has('code')).toBe(true);
  });

  it('returns a totalCourses count matching courses array length', async () => {
    const result = await getCourseInventory.handler({ platform: 'both' }, ctx);
    const data = result.data as CourseData;
    expect(data.totalCourses).toBe(data.courses.length);
  });
});

describe('getCourseInventory tool — beginner recommendations', () => {
  it('returns only beginner courses when beginner=true', async () => {
    const result = await getCourseInventory.handler({ beginner: true }, ctx);
    const data = result.data as CourseData;
    expect(data.courses.every((c) => c.beginner === true)).toBe(true);
  });

  it('provides a beginnerRecommendation', async () => {
    const result = await getCourseInventory.handler({ platform: 'code', beginner: true }, ctx);
    const data = result.data as CourseData;
    expect(data.beginnerRecommendation).not.toBeNull();
    expect(data.beginnerRecommendation?.title).toBeTruthy();
    expect(data.beginnerRecommendation?.platform).toBe('code');
  });

  it('beginnerRecommendation is from a beginner course', async () => {
    const result = await getCourseInventory.handler({ platform: 'academy' }, ctx);
    const data = result.data as CourseData;
    if (data.beginnerRecommendation) {
      const rec = data.courses.find((c) => c.title === data.beginnerRecommendation!.title);
      expect(rec?.beginner).toBe(true);
    }
  });

  it('returns beginner courses for both platforms', async () => {
    const result = await getCourseInventory.handler({ platform: 'both', beginner: true }, ctx);
    const data = result.data as CourseData;
    const platforms = new Set(data.courses.map((c) => c.platform));
    expect(platforms.has('academy')).toBe(true);
    expect(platforms.has('code')).toBe(true);
  });
});

describe('getCourseInventory tool — response shape', () => {
  it('each course has required fields', async () => {
    const result = await getCourseInventory.handler({}, ctx);
    const data = result.data as CourseData;
    for (const course of data.courses) {
      expect(course.title).toBeTruthy();
      expect(course.platform).toBeTruthy();
      expect(course.level).toBeTruthy();
      expect(course.description).toBeTruthy();
    }
  });

  it('includes a note field in the response', async () => {
    const result = await getCourseInventory.handler({}, ctx);
    const data = result.data as CourseData;
    expect(data.note).toBeTruthy();
  });
});
