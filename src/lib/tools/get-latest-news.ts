import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { extractHighlights, listGroundingSources, searchPlatformKnowledge } from '@/lib/knowledge';

const inputSchema = z.object({
  category: z
    .enum(['announcement', 'event', 'program', 'community', 'all'])
    .optional()
    .default('all')
    .describe("News category: 'announcement', 'event', 'program', 'community', or 'all'"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe('Maximum number of news items to return (1–10)'),
});

type NewsCategory = 'announcement' | 'event' | 'program' | 'community';
type NewsItem = {
  title: string;
  category: NewsCategory;
  summary: string;
  date: string;
  url: string;
  tags: string[];
};

/**
 * Curated fallback news catalogue used when the live knowledge index is not yet populated.
 * Sorted newest-first.
 */
const NEWS_ITEMS: NewsItem[] = [
  {
    title: 'EdLight Summer Leadership Program 2026 — Applications Now Open',
    category: 'program',
    summary:
      'Applications for the ESLP 2026 cohort are open. Students and young professionals in Haiti aged 16–25 are encouraged to apply before the spring deadline. The program runs for 4–6 weeks and is completely free.',
    date: '2026-02-15',
    url: 'https://www.edlight.org/news',
    tags: ['ESLP', 'leadership', 'applications', 'Haiti'],
  },
  {
    title: 'New Course: Python for Data Analysis — Now Live on EdLight Code',
    category: 'announcement',
    summary:
      'EdLight Code has launched a new intermediate course covering pandas, numpy, and real-world dataset projects. The course is available to all registered learners at no cost.',
    date: '2026-01-20',
    url: 'https://www.edlight.org/news',
    tags: ['Python', 'data analysis', 'EdLight Code', 'course launch'],
  },
  {
    title: 'EdLight News: External Scholarship Roundup — January 2026',
    category: 'announcement',
    summary:
      'EdLight News has published its latest curated list of external scholarships and educational opportunities available to learners in Haiti and the Caribbean. Visit EdLight News for details and application links.',
    date: '2026-01-10',
    url: 'https://www.edlightnews.com',
    tags: ['scholarships', 'external opportunities', 'EdLight News'],
  },
  {
    title: 'Digital Literacy Workshop in Port-au-Prince',
    category: 'event',
    summary:
      "EdLight organized a digital literacy workshop for high school students in Port-au-Prince, introducing 80 students to basic computer skills, internet safety, and EdLight's free learning platforms.",
    date: '2026-01-05',
    url: 'https://www.edlight.org/news',
    tags: ['digital literacy', 'workshop', 'community', 'Haiti'],
  },
  {
    title: 'EdLight Academy Adds Exam Preparation Support for Bac Students',
    category: 'announcement',
    summary:
      'EdLight Academy now has a dedicated Exam Preparation Support course for Haitian students preparing for the Baccalauréat. Covers math, physics, economics, and study skills.',
    date: '2025-12-10',
    url: 'https://www.edlight.org/academy',
    tags: ['Academy', 'exam prep', 'Bac', 'Haiti'],
  },
  {
    title: 'Community Spotlight: ESLP Alumni Leading Education Projects Across Haiti',
    category: 'community',
    summary:
      "This month's community spotlight features three ESLP alumni who launched education access projects in their communities, bringing digital learning tools to rural areas.",
    date: '2025-12-01',
    url: 'https://www.edlight.org/news',
    tags: ['ESLP', 'alumni', 'community impact', 'spotlight'],
  },
  {
    title: 'EdLight Code Reaches 1,000 Enrolled Learners',
    category: 'community',
    summary:
      'EdLight Code has reached a milestone of 1,000 enrolled learners across its coding courses. The platform continues to grow with new Python, SQL, and web development content.',
    date: '2025-11-01',
    url: 'https://www.edlight.org/news',
    tags: ['milestone', 'EdLight Code', 'learners', 'growth'],
  },
];

const getLatestNews: SandraTool = {
  name: 'getLatestNews',
  description:
    'Get the latest news, announcements, and updates from the EdLight community. Use this when users ask about recent events, new courses, program announcements, community stories, or what is new at EdLight.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: "News category: 'announcement', 'event', 'program', 'community', or 'all'",
        enum: ['announcement', 'event', 'program', 'community', 'all'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of news items to return (1–10)',
        minimum: 1,
        maximum: 10,
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['knowledge:read'],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    // Try to retrieve grounded news from the indexed knowledge base
    const query =
      params.category === 'all'
        ? 'EdLight news announcements updates community events programs latest'
        : `EdLight ${params.category} news announcements updates`;

    const knowledgeResults = await searchPlatformKnowledge(query, {
      platform: 'news',
      contentType: 'news',
      preferPaths: ['news/', 'announcements/', 'README.md', 'docs/'],
      topK: params.limit,
    });

    const highlights = extractHighlights(knowledgeResults, 5);
    const groundingSources = listGroundingSources(knowledgeResults);
    const grounding = knowledgeResults.length > 0 ? 'indexed' : 'fallback';

    // Apply category filter to the fallback catalogue
    const filtered =
      params.category === 'all'
        ? NEWS_ITEMS
        : NEWS_ITEMS.filter((item) => item.category === params.category);

    const items = filtered
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, params.limit);

    return {
      success: true,
      data: {
        items,
        total: items.length,
        category: params.category,
        grounding,
        groundingSources,
        highlights: highlights.length > 0 ? highlights : undefined,
        note:
          grounding === 'fallback'
            ? 'Showing curated recent updates. Live news index will provide real-time content when populated.'
            : undefined,
      },
    };
  },
};

toolRegistry.register(getLatestNews);
export { getLatestNews };
