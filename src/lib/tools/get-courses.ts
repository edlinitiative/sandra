import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import {
  extractCourseMatches,
  listGroundingSources,
  searchPlatformKnowledge,
} from '@/lib/knowledge';

const inputSchema = z.object({
  platform: z
    .enum(['academy', 'code', 'both'])
    .optional()
    .default('both')
    .describe("Which platform to query: 'academy', 'code', or 'both'"),
  beginner: z
    .boolean()
    .optional()
    .describe('When true, return only beginner-friendly courses'),
});

type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'general';
type PlatformCourse = 'academy' | 'code';
type CourseCatalogEntry = {
  title: string;
  platform: PlatformCourse;
  level: CourseLevel;
  topics: string[];
  path: string;
  url: string;
  description: string;
  beginner: boolean;
};

/**
 * Academy course catalogue — sourced from edlight.org/academy.
 * EdLight Academy offers 500+ video lessons, bilingual (Haitian Creole + French),
 * self-paced, mobile-friendly, aligned with Haitian national exams.
 */
const ACADEMY_COURSES: CourseCatalogEntry[] = [
  {
    title: 'Maths',
    platform: 'academy',
    level: 'general',
    topics: ['mathematics', 'algebra', 'geometry', 'calculus', 'problem solving'],
    path: 'courses/maths',
    url: 'https://academy.edlight.org',
    description:
      'Comprehensive maths curriculum aligned with Haitian national exams. Covers algebra, geometry, calculus, and problem-solving through bilingual video lessons in Haitian Creole and French.',
    beginner: true,
  },
  {
    title: 'Physics',
    platform: 'academy',
    level: 'general',
    topics: ['physics', 'mechanics', 'thermodynamics', 'science'],
    path: 'courses/physics',
    url: 'https://academy.edlight.org',
    description:
      'Physics video lessons covering mechanics, thermodynamics, and core concepts, aligned with Haitian national exams. Bilingual (Haitian Creole + French), self-paced.',
    beginner: false,
  },
  {
    title: 'Chemistry',
    platform: 'academy',
    level: 'general',
    topics: ['chemistry', 'reactions', 'elements', 'science'],
    path: 'courses/chemistry',
    url: 'https://academy.edlight.org',
    description:
      'Chemistry video lessons covering elements, reactions, and laboratory concepts, aligned with Haitian national exams. Bilingual (Haitian Creole + French), self-paced.',
    beginner: false,
  },
  {
    title: 'Economics',
    platform: 'academy',
    level: 'general',
    topics: ['economics', 'markets', 'analysis', 'finance'],
    path: 'courses/economics',
    url: 'https://academy.edlight.org',
    description:
      'Economics video lessons covering markets, incentives, and economic analysis, aligned with Haitian national exams. Bilingual (Haitian Creole + French), self-paced.',
    beginner: false,
  },
  {
    title: 'Languages & Communication',
    platform: 'academy',
    level: 'general',
    topics: ['languages', 'communication', 'french', 'creole', 'writing'],
    path: 'courses/languages',
    url: 'https://academy.edlight.org',
    description:
      'Language and communication lessons covering reading, writing, and oral expression in French and Haitian Creole. Aligned with the Haitian curriculum.',
    beginner: true,
  },
];

/**
 * Code course catalogue — sourced from edlight.org/code.
 * EdLight Code is free, browser-based, with verifiable certificates.
 * Available in English, French, and Haitian Creole.
 */
const CODE_COURSES: CourseCatalogEntry[] = [
  {
    title: 'SQL Track',
    platform: 'code',
    level: 'beginner',
    topics: ['sql', 'databases', 'queries', 'data'],
    path: 'tracks/sql',
    url: 'https://code.edlight.org',
    description:
      'Learn SQL from scratch through 6 courses (~60 hours total). Covers SELECT, WHERE, JOIN, GROUP BY, subqueries, window functions, and more. No prior experience required. Verifiable certificate upon completion.',
    beginner: true,
  },
  {
    title: 'Python Track',
    platform: 'code',
    level: 'beginner',
    topics: ['python', 'programming', 'data', 'automation'],
    path: 'tracks/python',
    url: 'https://code.edlight.org',
    description:
      'Master Python through 7 courses (~55 hours total). Covers variables, data types, loops, functions, data analysis, and real-world projects. Starts from absolute beginner. Verifiable certificate upon completion.',
    beginner: true,
  },
  {
    title: 'Terminal & Git Track',
    platform: 'code',
    level: 'beginner',
    topics: ['terminal', 'git', 'command line', 'version control'],
    path: 'tracks/terminal-git',
    url: 'https://code.edlight.org',
    description:
      'Learn to use the terminal and Git version control through 3 courses (~9 hours total). Essential skills for any developer. Verifiable certificate upon completion.',
    beginner: true,
  },
  {
    title: 'HTML Track',
    platform: 'code',
    level: 'beginner',
    topics: ['html', 'web', 'markup', 'structure'],
    path: 'tracks/html',
    url: 'https://code.edlight.org',
    description:
      'Learn HTML through 3 courses (~12 hours total). Build the structure of web pages from scratch. No prior experience required. Verifiable certificate upon completion.',
    beginner: true,
  },
  {
    title: 'CSS Track',
    platform: 'code',
    level: 'beginner',
    topics: ['css', 'web', 'styling', 'design'],
    path: 'tracks/css',
    url: 'https://code.edlight.org',
    description:
      'Learn CSS through 3 courses (~14 hours total). Style web pages with layouts, colors, typography, and responsive design. Verifiable certificate upon completion.',
    beginner: true,
  },
  {
    title: 'JavaScript Track',
    platform: 'code',
    level: 'beginner',
    topics: ['javascript', 'web', 'programming', 'interactivity'],
    path: 'tracks/javascript',
    url: 'https://code.edlight.org',
    description:
      'Learn JavaScript through 3 courses (~14 hours total). Add interactivity to web pages, work with DOM manipulation, and build dynamic applications. Verifiable certificate upon completion.',
    beginner: true,
  },
];

const ALL_COURSES = [...ACADEMY_COURSES, ...CODE_COURSES];

const PLATFORM_CONTEXT: Record<'academy' | 'code' | 'both', string> = {
  academy:
    'EdLight Academy is a free online learning platform with 500+ bilingual video lessons (Haitian Creole + French) in Maths, Physics, Chemistry, Economics, and Languages & Communication. Curriculum-aligned with Haitian national exams, self-paced, mobile-friendly, and available 24/7 at academy.edlight.org.',
  code:
    'EdLight Code is a free, browser-based coding education platform with 6 learning tracks: SQL (~60h), Python (~55h), Terminal & Git (~9h), HTML (~12h), CSS (~14h), and JavaScript (~14h). Learners earn verifiable certificates. Available in English, French, and Haitian Creole at code.edlight.org.',
  both:
    'EdLight Academy offers 500+ bilingual video lessons in academic subjects (Maths, Physics, Chemistry, Economics, Languages), while EdLight Code offers 6 coding tracks (SQL, Python, Terminal & Git, HTML, CSS, JavaScript) with verifiable certificates.',
};

const PLATFORM_REPO_URLS = {
  academy: 'https://github.com/edlinitiative/EdLight-Academy',
  code: 'https://github.com/edlinitiative/code',
} as const;

type PlatformSelection = 'academy' | 'code' | 'both';
type GroundedCourse = {
  title: string;
  platform: PlatformCourse;
  level: CourseLevel;
  topics: string[];
  path?: string;
  url: string;
  description: string;
  beginner: boolean;
  grounding: 'indexed' | 'fallback';
};

const getCourseInventory: SandraTool = {
  name: 'getCourseInventory',
  description:
    "Get the list of courses available on EdLight Academy and/or EdLight Code. Use this tool when users ask about what courses exist, what they can learn, or which course to start with. Do NOT use getEdLightInitiatives for course listing questions — use this tool instead.",
  parameters: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        description: "Platform to query: 'academy', 'code', or 'both'",
        enum: ['academy', 'code', 'both'],
        default: 'both',
      },
      beginner: {
        type: 'boolean',
        description: 'When true, return only beginner-friendly courses',
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['knowledge:read'],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const platform = (params.platform ?? 'both') as PlatformSelection;
    const selectedPlatforms: PlatformCourse[] =
      platform === 'both' ? ['academy', 'code'] : [platform];

    const groundedCatalogs: Array<{
      courses: GroundedCourse[];
      grounding: 'indexed' | 'fallback';
      sources: string[];
    }> = await Promise.all(
      selectedPlatforms.map(async (selectedPlatform) => {
        const groundedResults = await searchPlatformKnowledge(
          `${selectedPlatform} courses curriculum lessons modules`,
          {
            platform: selectedPlatform,
            contentType: 'course',
            preferPaths: ['courses/', 'docs/', 'curriculum', 'README.md'],
            topK: 8,
          },
        );

        const extractedCourses: GroundedCourse[] = extractCourseMatches(groundedResults, selectedPlatform).map((course) => ({
          title: course.title,
          platform: selectedPlatform,
          level: course.level,
          topics: inferTopics(course.title, course.description),
          path: course.path,
          url: course.path
            ? `${PLATFORM_REPO_URLS[selectedPlatform]}/blob/main/${course.path}`
            : PLATFORM_REPO_URLS[selectedPlatform],
          description: course.description,
          beginner: course.beginner,
          grounding: 'indexed' as const,
        }));

        const fallbackCourses: GroundedCourse[] = ALL_COURSES.filter((course) => course.platform === selectedPlatform)
          .map((course) => ({
            ...course,
            grounding: 'fallback' as const,
          }));

        return {
          courses: extractedCourses.length > 0 ? extractedCourses : fallbackCourses,
          grounding: extractedCourses.length > 0 ? 'indexed' : 'fallback',
          sources: listGroundingSources(groundedResults),
        };
      }),
    );

    let courses = groundedCatalogs.flatMap((catalog) => catalog.courses);

    if (params.beginner === true) {
      courses = courses.filter((course) => course.beginner);
    }

    const beginnerCourses = courses.filter((course) => course.beginner);
    const recommendation = beginnerCourses[0] ?? courses[0] ?? null;
    const grounding = groundedCatalogs.every((catalog) => catalog.grounding === 'indexed')
      ? 'indexed'
      : groundedCatalogs.some((catalog) => catalog.grounding === 'indexed')
        ? 'mixed'
        : 'fallback';
    const groundingSources = groundedCatalogs.flatMap((catalog) => catalog.sources);

    return {
      success: true,
      data: {
        platform,
        platformContext: PLATFORM_CONTEXT[platform] ?? PLATFORM_CONTEXT['both'],
        courses: courses.map((course) => ({
          title: course.title,
          platform: course.platform,
          level: course.level,
          topics: course.topics,
          description: course.description,
          path: course.path,
          url: course.url,
          beginner: course.beginner,
          grounding: course.grounding,
        })),
        totalCourses: courses.length,
        beginnerRecommendation: recommendation
          ? {
              title: recommendation.title,
              platform: recommendation.platform,
              description: recommendation.description,
            }
          : null,
        grounding,
        groundingSources: Array.from(new Set(groundingSources)),
        note:
          grounding === 'indexed'
            ? 'Course inventory was grounded from indexed EdLight repository content.'
            : grounding === 'mixed'
              ? 'Course inventory combines indexed EdLight content with curated fallback entries where indexed course data is still thin.'
              : 'Indexed course data was unavailable, so Sandra used the curated fallback course catalog.',
      },
    };
  },
};

toolRegistry.register(getCourseInventory);

export { getCourseInventory };

function inferTopics(title: string, description: string): string[] {
  const haystack = `${title} ${description}`.toLowerCase();
  const knownTopics = [
    'python',
    'sql',
    'web',
    'math',
    'physics',
    'economics',
    'leadership',
    'exam prep',
    'communication',
    'problem solving',
  ].filter((topic) => haystack.includes(topic));

  if (knownTopics.length > 0) {
    return knownTopics;
  }

  return title
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length > 3)
    .slice(0, 3);
}
