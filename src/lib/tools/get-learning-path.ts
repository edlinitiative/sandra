/**
 * getLearningPath — generate a personalized step-by-step learning path
 * based on the user's goal, skill level, and existing enrollments.
 *
 * Required scopes: profile:read (falls back to public path if unauthenticated)
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';

const inputSchema = z.object({
  goal: z
    .string()
    .min(3)
    .max(300)
    .describe("The learning goal or career objective, e.g. 'become a web developer', 'pass the bac exam', 'learn Python for data science'"),
  skillLevel: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .optional()
    .default('beginner')
    .describe("Current skill level: 'beginner', 'intermediate', or 'advanced'"),
  language: z
    .enum(['en', 'fr', 'ht'])
    .optional()
    .describe("Preferred learning language: 'en' (English), 'fr' (French), 'ht' (Haitian Creole)"),
  availableHoursPerWeek: z
    .number()
    .min(1)
    .max(40)
    .optional()
    .default(5)
    .describe('How many hours per week the user can dedicate to learning'),
});

// ─── Curated learning paths ───────────────────────────────────────────────────

const LEARNING_PATHS: Record<string, {
  title: string;
  description: string;
  totalHours: number;
  steps: Array<{ step: number; title: string; platform: string; url: string; hours: number; description: string }>;
}> = {
  'web-development': {
    title: 'Web Development',
    description: 'Learn to build websites and web applications from scratch.',
    totalHours: 90,
    steps: [
      { step: 1, title: 'HTML Fundamentals', platform: 'EdLight Code', url: 'https://code.edlight.org', hours: 12, description: 'Learn the building blocks of web pages: structure, elements, and semantic HTML.' },
      { step: 2, title: 'CSS Styling', platform: 'EdLight Code', url: 'https://code.edlight.org', hours: 14, description: 'Learn to style web pages: selectors, layouts, Flexbox, and Grid.' },
      { step: 3, title: 'JavaScript Basics', platform: 'EdLight Code', url: 'https://code.edlight.org', hours: 14, description: 'Learn programming with JavaScript: variables, functions, DOM manipulation, and events.' },
      { step: 4, title: 'Terminal & Git', platform: 'EdLight Code', url: 'https://code.edlight.org', hours: 9, description: 'Learn command line navigation and version control with Git and GitHub.' },
      { step: 5, title: 'Build Your First Project', platform: 'Self-directed', url: 'https://code.edlight.org', hours: 20, description: 'Apply your skills by building a personal portfolio website and deploying it online.' },
      { step: 6, title: 'Apply to EdLight Labs', platform: 'EdLight Labs', url: 'https://www.edlight.org/labs', hours: 0, description: 'Once comfortable, apply to EdLight Labs to work on real client projects with mentorship.' },
    ],
  },
  'data-science': {
    title: 'Data Science & Python',
    description: 'Learn Python programming and data analysis.',
    totalHours: 115,
    steps: [
      { step: 1, title: 'Terminal & Git', platform: 'EdLight Code', url: 'https://code.edlight.org', hours: 9, description: 'Master the command line before diving into Python.' },
      { step: 2, title: 'Python Programming', platform: 'EdLight Code', url: 'https://code.edlight.org', hours: 55, description: 'Full Python course: data types, functions, files, OOP, and libraries.' },
      { step: 3, title: 'SQL for Data', platform: 'EdLight Code', url: 'https://code.edlight.org', hours: 60, description: 'Learn SQL to query databases — essential for any data role.' },
      { step: 4, title: 'Data Analysis Project', platform: 'Self-directed', url: 'https://code.edlight.org', hours: 20, description: 'Analyze a real dataset using Python and pandas, create visualizations, and share your findings.' },
    ],
  },
  'mathematics': {
    title: 'Mathematics for the Bac Exam',
    description: 'Master maths at the level required for the Haitian baccalaureate.',
    totalHours: 120,
    steps: [
      { step: 1, title: 'Algebra & Functions', platform: 'EdLight Academy', url: 'https://academy.edlight.org', hours: 30, description: 'Equations, inequalities, polynomials, and function analysis.' },
      { step: 2, title: 'Geometry & Trigonometry', platform: 'EdLight Academy', url: 'https://academy.edlight.org', hours: 25, description: 'Euclidean geometry, trigonometry, and coordinate geometry.' },
      { step: 3, title: 'Statistics & Probability', platform: 'EdLight Academy', url: 'https://academy.edlight.org', hours: 20, description: 'Descriptive statistics, probability distributions, and data interpretation.' },
      { step: 4, title: 'Calculus Introduction', platform: 'EdLight Academy', url: 'https://academy.edlight.org', hours: 25, description: 'Limits, derivatives, and integrals — core for university entry.' },
      { step: 5, title: 'Practice Exams', platform: 'EdLight Academy', url: 'https://academy.edlight.org', hours: 20, description: 'Review past bac exam papers and practice timed tests.' },
    ],
  },
  'leadership': {
    title: 'Leadership & Personal Development',
    description: 'Develop leadership skills and prepare for programs like ESLP.',
    totalHours: 40,
    steps: [
      { step: 1, title: 'Community & Civic Engagement', platform: 'EdLight Academy', url: 'https://academy.edlight.org', hours: 10, description: 'Understand your role as a community leader and civic actor.' },
      { step: 2, title: 'Public Speaking & Communication', platform: 'Self-directed + EdLight Academy', url: 'https://academy.edlight.org', hours: 10, description: 'Practice structured communication and presentation skills.' },
      { step: 3, title: 'Critical Thinking', platform: 'EdLight Academy', url: 'https://academy.edlight.org', hours: 10, description: 'Learn to analyze problems, evaluate arguments, and make decisions.' },
      { step: 4, title: 'Apply to ESLP', platform: 'EdLight ESLP', url: 'https://www.edlight.org/eslp', hours: 0, description: 'Apply to the EdLight Summer Leadership Program — a fully funded, immersive leadership experience.' },
      { step: 5, title: 'Explore Nexus', platform: 'EdLight Nexus', url: 'https://www.edlight.org/nexus', hours: 0, description: 'Consider applying to Nexus for an international exchange experience.' },
    ],
  },
};

function inferPath(goal: string): string {
  const g = goal.toLowerCase();
  if (g.includes('web') || g.includes('html') || g.includes('css') || g.includes('javascript') || g.includes('frontend') || g.includes('developer')) return 'web-development';
  if (g.includes('python') || g.includes('data') || g.includes('sql') || g.includes('machine learning') || g.includes('ai')) return 'data-science';
  if (g.includes('math') || g.includes('maths') || g.includes('bac') || g.includes('algebra') || g.includes('calculus') || g.includes('physique')) return 'mathematics';
  if (g.includes('leader') || g.includes('eslp') || g.includes('nexus') || g.includes('community') || g.includes('civic')) return 'leadership';
  return 'web-development'; // default
}

const getLearningPathTool: SandraTool = {
  name: 'getLearningPath',
  description:
    "Generate a personalized step-by-step learning path for the user based on their goal and skill level. Use when the user asks how to learn something, how to achieve a career goal, what courses to take, or how to prepare for an exam or program.",
  parameters: {
    type: 'object',
    properties: {
      goal: { type: 'string', description: "User's learning goal or career objective" },
      skillLevel: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced'],
        description: "Current skill level (default: beginner)",
        default: 'beginner',
      },
      language: {
        type: 'string',
        enum: ['en', 'fr', 'ht'],
        description: "Preferred learning language",
      },
      availableHoursPerWeek: {
        type: 'number',
        description: 'Hours per week available for learning (default: 5)',
        default: 5,
      },
    },
    required: ['goal'],
  },
  inputSchema,
  requiredScopes: [],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    // Load existing enrollments if authenticated
    let existingEnrollments: string[] = [];
    if (context.userId) {
      try {
        const enrollments = await db.enrollment.findMany({
          where: { userId: context.userId },
          select: { courseName: true, status: true },
        });
        existingEnrollments = enrollments.map((e) => e.courseName);
      } catch {
        // Best-effort
      }
    }

    const pathKey = inferPath(params.goal);
    const path = LEARNING_PATHS[pathKey];
    if (!path) {
      return {
        success: false,
        data: null,
        error: 'Could not generate a learning path for this goal.',
      };
    }

    // Estimate weeks to complete
    const weeksToComplete = Math.ceil(path.totalHours / (params.availableHoursPerWeek ?? 5));

    // Filter already completed steps
    const steps = path.steps.map((step) => ({
      ...step,
      alreadyEnrolled: existingEnrollments.some((e) => e.toLowerCase().includes(step.platform.toLowerCase())),
    }));

    return {
      success: true,
      data: {
        goal: params.goal,
        recommendedPath: path.title,
        description: path.description,
        totalHours: path.totalHours,
        estimatedWeeksAt5hPerWeek: weeksToComplete,
        skillLevel: params.skillLevel ?? 'beginner',
        steps,
        tip: existingEnrollments.length > 0
          ? `You already have ${existingEnrollments.length} enrollment(s). Continue from where you left off!`
          : 'All EdLight Code and Academy courses are free — start today!',
      },
    };
  },
};

toolRegistry.register(getLearningPathTool);
export { getLearningPathTool };
