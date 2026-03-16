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
    title: 'Introduction to EdLight Academy',
    platform: 'academy',
    level: 'beginner',
    topics: ['orientation', 'platform overview'],
    path: 'courses/intro',
    description:
      'Get started with EdLight Academy. Learn how the platform works, how to navigate courses, and how to track your progress.',
    beginner: true,
  },
  {
    title: 'Digital Literacy Fundamentals',
    platform: 'academy',
    level: 'beginner',
    topics: ['digital skills', 'computers', 'internet'],
    path: 'courses/digital-literacy',
    description:
      'Build foundational digital skills — using computers, navigating the web, creating files, and staying safe online.',
    beginner: true,
  },
  {
    title: 'Productivity Tools: Microsoft Office Suite',
    platform: 'academy',
    level: 'beginner',
    topics: ['excel', 'word', 'powerpoint', 'office'],
    path: 'courses/office-suite',
    description:
      'Learn Word, Excel, and PowerPoint for professional and academic use. Covers documents, spreadsheets, and presentations.',
    beginner: true,
  },
  {
    title: 'Data Skills with Excel',
    platform: 'academy',
    level: 'intermediate',
    topics: ['excel', 'data', 'spreadsheets', 'formulas'],
    path: 'courses/excel-data-skills',
    description:
      'Go deeper with Excel: pivot tables, VLOOKUP, data visualization, and analysis fundamentals.',
    beginner: false,
  },
  {
    title: 'Presentation Skills with PowerPoint',
    platform: 'academy',
    level: 'beginner',
    topics: ['powerpoint', 'presentations', 'design'],
    path: 'courses/powerpoint-presentations',
    description:
      'Create compelling presentations using PowerPoint — layout, design principles, and slide storytelling.',
    beginner: true,
  },
  {
    title: 'Introduction to 3D Design',
    platform: 'academy',
    level: 'beginner',
    topics: ['3d', 'design', 'modeling'],
    path: 'courses/intro-3d-design',
    description:
      'Explore 3D design concepts and tools. No prior experience needed — covers basic modeling, shapes, and rendering.',
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

    return {
      success: true,
      data: {
        platform,
        courses: courses.map((c) => ({
          title: c.title,
          platform: c.platform,
          level: c.level,
          topics: c.topics,
          description: c.description,
          path: c.path,
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
