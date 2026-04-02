/**
 * recommendCourses — personalized course recommendation.
 *
 * Matches the user's stated interest, language, and level to the EdLight
 * course catalogue and returns a ranked shortlist of up to 3 recommendations.
 *
 * This is a read-only action (no approval required).
 * Required scopes: knowledge:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { actionRateLimiter } from '@/lib/actions/rate-limiter';

const inputSchema = z.object({
  interest: z
    .string()
    .optional()
    .describe('What the user wants to learn, e.g. "web development", "math", "databases"'),
  language: z
    .enum(['en', 'fr', 'ht'])
    .optional()
    .default('en')
    .describe('Preferred content language'),
  level: z
    .enum(['beginner', 'intermediate', 'advanced', 'any'])
    .optional()
    .default('any')
    .describe('Experience level'),
});

type CourseEntry = {
  title: string;
  platform: 'academy' | 'code';
  url: string;
  description: string;
  beginner: boolean;
  topics: string[];
};

const CATALOGUE: CourseEntry[] = [
  // EdLight Code
  { title: 'SQL Track', platform: 'code', url: 'https://code.edlight.org', description: 'Learn SQL from scratch — SELECT, JOIN, window functions. ~60 hours. Verifiable certificate.', beginner: true, topics: ['sql', 'databases', 'data'] },
  { title: 'Python Track', platform: 'code', url: 'https://code.edlight.org', description: 'Master Python through 7 courses (~55 hours). Variables, loops, data analysis, real-world projects.', beginner: true, topics: ['python', 'programming', 'data', 'automation'] },
  { title: 'Terminal & Git Track', platform: 'code', url: 'https://code.edlight.org', description: 'Learn the terminal and Git version control (~9 hours). Essential developer skills.', beginner: true, topics: ['terminal', 'git', 'command line', 'developer tools'] },
  { title: 'HTML Track', platform: 'code', url: 'https://code.edlight.org', description: 'Build web page structure with HTML (~12 hours). No prior experience required.', beginner: true, topics: ['html', 'web', 'markup'] },
  { title: 'CSS Track', platform: 'code', url: 'https://code.edlight.org', description: 'Style web pages with layouts and responsive design (~14 hours).', beginner: true, topics: ['css', 'web', 'styling', 'design'] },
  { title: 'JavaScript Track', platform: 'code', url: 'https://code.edlight.org', description: 'Add interactivity to web pages with JavaScript (~14 hours). DOM manipulation, dynamic apps.', beginner: true, topics: ['javascript', 'web', 'programming', 'interactivity'] },
  // EdLight Academy
  { title: 'Maths', platform: 'academy', url: 'https://academy.edlight.org', description: 'Algebra, geometry, calculus — bilingual (Creole + French), aligned with Haitian national exams.', beginner: true, topics: ['maths', 'algebra', 'geometry', 'calculus', 'exam prep'] },
  { title: 'Physics', platform: 'academy', url: 'https://academy.edlight.org', description: 'Mechanics, thermodynamics — bilingual, curriculum-aligned.', beginner: false, topics: ['physics', 'mechanics', 'science', 'exam prep'] },
  { title: 'Chemistry', platform: 'academy', url: 'https://academy.edlight.org', description: 'Elements, reactions, laboratory concepts — bilingual, curriculum-aligned.', beginner: false, topics: ['chemistry', 'reactions', 'science', 'exam prep'] },
  { title: 'Economics', platform: 'academy', url: 'https://academy.edlight.org', description: 'Markets, incentives, economic analysis — bilingual, curriculum-aligned.', beginner: false, topics: ['economics', 'markets', 'finance', 'exam prep'] },
  { title: 'Languages & Communication', platform: 'academy', url: 'https://academy.edlight.org', description: 'Reading, writing, oral expression in French and Haitian Creole.', beginner: true, topics: ['languages', 'communication', 'french', 'creole', 'writing'] },
];

function scoreFor(course: CourseEntry, interest: string, level: string): number {
  const haystack = course.topics.join(' ') + ' ' + course.title.toLowerCase() + ' ' + course.description.toLowerCase();
  const query = interest.toLowerCase();
  const words = query.split(/\s+/);
  const matchScore = words.reduce((score, word) => score + (haystack.includes(word) ? 2 : 0), 0);
  const levelScore = level === 'beginner' && course.beginner ? 1 : level === 'any' ? 0.5 : 0;
  return matchScore + levelScore;
}

const recommendCourses: SandraTool = {
  name: 'recommendCourses',
  description:
    'Recommend EdLight courses personalised to the user\'s interest, preferred language, and experience level. Use this when the user asks what they should study, which course is best for them, or needs guidance on where to start.',
  parameters: {
    type: 'object',
    properties: {
      interest: { type: 'string', description: 'What the user wants to learn' },
      language: { type: 'string', enum: ['en', 'fr', 'ht'], description: 'Preferred content language', default: 'en' },
      level:    { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'any'], description: 'Experience level', default: 'any' },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['knowledge:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const interest = params.interest ?? '';
    const level = params.level ?? 'any';

    // Soft rate-limit
    const userId = context.userId ?? context.sessionId;
    if (!actionRateLimiter.isAllowed(userId, 'recommendCourses')) {
      return { success: false, data: null, error: 'Rate limit reached for course recommendations. Please wait a few minutes.' };
    }
    actionRateLimiter.consume(userId, 'recommendCourses');

    let scored = CATALOGUE.map((course) => ({
      course,
      score: interest ? scoreFor(course, interest, level) : (course.beginner ? 1.5 : 0.5),
    }));

    if (level === 'beginner') {
      scored = scored.filter(({ course }) => course.beginner);
    }

    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3).map(({ course }) => course);

    const languageNote =
      params.language === 'ht'
        ? 'EdLight Academy content is bilingual in Haitian Creole and French.'
        : params.language === 'fr'
        ? 'EdLight Academy content is bilingual in French and Haitian Creole. EdLight Code is available in French.'
        : 'All EdLight Code tracks are available in English, French, and Haitian Creole.';

    return {
      success: true,
      data: {
        recommendations: top3.map((c) => ({
          title: c.title,
          platform: c.platform,
          url: c.url,
          description: c.description,
          beginner: c.beginner,
        })),
        totalMatches: scored.length,
        languageNote,
        callToAction: 'Visit edlight.org to start learning for free.',
      },
    };
  },
};

toolRegistry.register(recommendCourses);
export { recommendCourses };
