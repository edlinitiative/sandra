import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';

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

/** Static course catalog — sourced from EdLight repos (updated as repos are indexed). */
const ACADEMY_COURSES = [
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

const CODE_COURSES = [
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
    const platform = params.platform ?? 'both';

    let courses = platform === 'both'
      ? ALL_COURSES
      : ALL_COURSES.filter((c) => c.platform === platform);

    if (params.beginner === true) {
      courses = courses.filter((c) => c.beginner);
    }

    const beginnerCourses = courses.filter((c) => c.beginner);
    const recommendation = beginnerCourses.length > 0
      ? beginnerCourses[0]
      : courses[0] ?? null;

    const platformContext: Record<string, string> = {
      academy: 'EdLight Academy focuses on academic learning for students — especially high school learners — with structured subjects like math, physics, economics, leadership, and exam preparation.',
      code: 'EdLight Code focuses on coding and programming skills — Python, SQL, web development, and software fundamentals.',
      both: 'EdLight Academy covers academic subjects and student learning support; EdLight Code covers coding and programming.',
    };

    return {
      success: true,
      data: {
        platform,
        platformContext: platformContext[platform] ?? platformContext['both'],
        courses: courses.map((c) => ({
          title: c.title,
          platform: c.platform,
          level: c.level,
          topics: c.topics,
          description: c.description,
          path: c.path,
          url: c.url,
          beginner: c.beginner,
        })),
        totalCourses: courses.length,
        beginnerRecommendation: recommendation
          ? {
              title: recommendation.title,
              platform: recommendation.platform,
              description: recommendation.description,
            }
          : null,
        note: 'Course catalog reflects EdLight repository content. Use searchKnowledgeBase for detailed course documentation.',
      },
    };
  },
};

toolRegistry.register(getCourseInventory);

export { getCourseInventory };
