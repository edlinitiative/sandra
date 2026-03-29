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
 * Based on real information from edlight.org. Sorted newest-first.
 */
const NEWS_ITEMS: NewsItem[] = [
  {
    title: 'EdLight Nexus — Barcelona Mobility Residency at ESADE Business School',
    category: 'program',
    summary:
      'EdLight Nexus featured its Barcelona Mobility Residency at ESADE Business School, offering Haitian university students a 7-day immersive experience in one of Europe\'s top business schools. Since launch, 48 fellows from 10+ Haitian cities have participated across 6+ international destinations.',
    date: '2026-02-15',
    url: 'https://www.edlight.org/nexus',
    tags: ['Nexus', 'exchange', 'Barcelona', 'ESADE', 'university'],
  },
  {
    title: 'EdLight Code Now Offers 6 Learning Tracks with Verifiable Certificates',
    category: 'announcement',
    summary:
      'EdLight Code has expanded to 6 learning tracks: SQL (~60h), Python (~55h), Terminal & Git (~9h), HTML (~12h), CSS (~14h), and JavaScript (~14h). All courses are free, browser-based, and available in English, French, and Haitian Creole. Learners earn verifiable certificates with unique URLs.',
    date: '2026-01-20',
    url: 'https://code.edlight.org',
    tags: ['EdLight Code', 'coding', 'certificates', 'tracks'],
  },
  {
    title: 'EdLight News: External Scholarship Roundup',
    category: 'announcement',
    summary:
      'EdLight News has published its latest curated list of external scholarships and educational opportunities available to learners in Haiti and the Caribbean. EdLight does not offer its own scholarships, but EdLight News curates external opportunities. Visit EdLight News for details.',
    date: '2026-01-10',
    url: 'https://news.edlight.org/bourses',
    tags: ['scholarships', 'external opportunities', 'EdLight News'],
  },
  {
    title: 'EdLight Academy Reaches 500+ Video Lessons',
    category: 'announcement',
    summary:
      'EdLight Academy now offers 500+ free bilingual video lessons in Maths, Physics, Chemistry, Economics, and Languages & Communication. All content is in Haitian Creole and French, aligned with Haitian national exams, self-paced, and mobile-friendly at academy.edlight.org.',
    date: '2026-01-05',
    url: 'https://academy.edlight.org',
    tags: ['Academy', 'video lessons', 'bilingual', 'Haiti'],
  },
  {
    title: 'EdLight Labs Surpasses 25 Digital Builds',
    category: 'community',
    summary:
      'EdLight Labs has launched 25+ digital builds for schools, nonprofits, and startups across Haiti and the diaspora. Labs pairs student developers with real-world client projects through its mentorship pipeline.',
    date: '2025-12-10',
    url: 'https://www.edlight.org/labs',
    tags: ['Labs', 'digital products', 'innovation', 'mentorship'],
  },
  {
    title: 'Community Spotlight: ESLP Alumni Making Impact Across Haiti',
    category: 'community',
    summary:
      'ESLP alumni continue to make an impact in their communities after completing the 2-week summer leadership program. ESLP serves approximately 30 high school students aged 15–18 per cohort through intensive seminars, capstone challenges, and expert mentorship.',
    date: '2025-12-01',
    url: 'https://www.edlight.org/eslp',
    tags: ['ESLP', 'alumni', 'community impact', 'spotlight'],
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
