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

const ACADEMY_COURSES: CourseCatalogEntry[] = [
  {
    title: 'Mathematics Fundamentals',
    platform: 'academy',
    level: 'beginner',
    topics: ['mathematics', 'problem solving', 'foundations'],
    path: 'courses/mathematics-fundamentals',
    url: 'https://www.edlight.org/academy',
    description:
      'Build core mathematics skills through structured lessons designed for students who want to strengthen their academic foundation.',
    beginner: true,
  },
  {
    title: 'Physics Foundations',
    platform: 'academy',
    level: 'intermediate',
    topics: ['physics', 'science', 'concepts'],
    path: 'courses/physics-foundations',
    url: 'https://www.edlight.org/academy',
    description:
      'Learn essential physics concepts through guided academic content aimed at high school students.',
    beginner: false,
  },
  {
    title: 'Economics Essentials',
    platform: 'academy',
    level: 'intermediate',
    topics: ['economics', 'markets', 'analysis'],
    path: 'courses/economics-essentials',
    url: 'https://www.edlight.org/academy',
    description:
      'Explore core economics concepts to help students better understand markets, incentives, and decision-making.',
    beginner: false,
  },
  {
    title: 'Leadership and Personal Development',
    platform: 'academy',
    level: 'beginner',
    topics: ['leadership', 'communication', 'growth'],
    path: 'courses/leadership-personal-development',
    url: 'https://www.edlight.org/academy',
    description:
      'Develop leadership, communication, and personal growth skills through structured learning content.',
    beginner: true,
  },
  {
    title: 'Exam Preparation Support',
    platform: 'academy',
    level: 'beginner',
    topics: ['exam prep', 'revision', 'study skills'],
    path: 'courses/exam-preparation-support',
    url: 'https://www.edlight.org/academy',
    description:
      'Review important academic content and strengthen study habits to prepare effectively for exams.',
    beginner: true,
  },
];

const CODE_COURSES: CourseCatalogEntry[] = [
  {
    title: 'Coding for Absolute Beginners',
    platform: 'code',
    level: 'beginner',
    topics: ['programming basics', 'logic', 'problem solving'],
    path: 'courses/coding-101',
    url: 'https://github.com/edlinitiative/code/tree/main/courses/coding-101',
    description:
      'Your first step into coding. Learn what code is, how computers think, and write your very first programs.',
    beginner: true,
  },
  {
    title: 'Python Fundamentals',
    platform: 'code',
    level: 'beginner',
    topics: ['python', 'programming', 'syntax'],
    path: 'courses/python-fundamentals',
    url: 'https://github.com/edlinitiative/code/tree/main/courses/python-fundamentals',
    description:
      'Learn Python from scratch — variables, data types, loops, functions, and building simple programs.',
    beginner: true,
  },
  {
    title: 'Python for Data Analysis',
    platform: 'code',
    level: 'intermediate',
    topics: ['python', 'data', 'pandas', 'analysis'],
    path: 'courses/python-data-analysis',
    url: 'https://github.com/edlinitiative/code/tree/main/courses/python-data-analysis',
    description:
      'Use Python to work with data: loading, cleaning, and analyzing datasets with pandas and numpy.',
    beginner: false,
  },
  {
    title: 'SQL and Databases',
    platform: 'code',
    level: 'beginner',
    topics: ['sql', 'databases', 'queries', 'data'],
    path: 'courses/sql-databases',
    url: 'https://github.com/edlinitiative/code/tree/main/courses/sql-databases',
    description:
      'Learn SQL to query databases — SELECT, WHERE, JOIN, and GROUP BY. No prior experience required.',
    beginner: true,
  },
  {
    title: 'Advanced SQL',
    platform: 'code',
    level: 'intermediate',
    topics: ['sql', 'subqueries', 'optimization', 'analytics'],
    path: 'courses/advanced-sql',
    url: 'https://github.com/edlinitiative/code/tree/main/courses/advanced-sql',
    description:
      'Master advanced SQL: window functions, CTEs, subqueries, and query optimization techniques.',
    beginner: false,
  },
  {
    title: 'Web Development Basics',
    platform: 'code',
    level: 'beginner',
    topics: ['html', 'css', 'javascript', 'web'],
    path: 'courses/web-dev-basics',
    url: 'https://github.com/edlinitiative/code/tree/main/courses/web-dev-basics',
    description:
      'Build your first web pages using HTML, CSS, and JavaScript. Learn how the web works from the ground up.',
    beginner: true,
  },
];

const ALL_COURSES = [...ACADEMY_COURSES, ...CODE_COURSES];

const PLATFORM_CONTEXT: Record<'academy' | 'code' | 'both', string> = {
  academy:
    'EdLight Academy focuses on academic learning for students, with structured subjects such as math, physics, economics, leadership, and exam preparation.',
  code:
    'EdLight Code focuses on coding and programming skills, including Python, SQL, web development, and software fundamentals.',
  both:
    'EdLight Academy covers academic subjects and student learning support, while EdLight Code covers coding and programming.',
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
