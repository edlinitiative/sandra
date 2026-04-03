/**
 * searchScholarships — search for scholarship and funding opportunities
 * curated by EdLight News and the broader EdLight ecosystem.
 *
 * Required scopes: public (none required)
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { searchPlatformKnowledge } from '@/lib/knowledge';

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .default('scholarship funding opportunity')
    .describe('Search query, e.g. "undergraduate scholarship France", "coding bootcamp funding Haiti"'),
  field: z
    .string()
    .max(100)
    .optional()
    .describe('Field of study or domain, e.g. "engineering", "medicine", "business"'),
  country: z
    .string()
    .max(100)
    .optional()
    .describe('Target country or region for the scholarship, e.g. "France", "United States", "Canada"'),
  level: z
    .enum(['undergraduate', 'graduate', 'phd', 'any'])
    .optional()
    .default('any')
    .describe("Academic level: 'undergraduate', 'graduate', 'phd', or 'any'"),
});

const SCHOLARSHIP_CATALOGUE = [
  {
    name: 'Fulbright Foreign Student Program',
    provider: 'U.S. Department of State',
    level: 'graduate',
    countries: ['United States'],
    fields: ['any'],
    description: 'Fully funded graduate study in the United States for international students, including Haitians. Covers tuition, airfare, living stipend, and health insurance.',
    deadline: 'Varies by country — typically October/November for the following academic year.',
    url: 'https://foreign.fulbrightonline.org/',
    tags: ['USA', 'fully funded', 'graduate', 'Haiti eligible'],
  },
  {
    name: 'Orange Corners Innovation Fund (Haiti)',
    provider: 'Orange Corners / Netherlands Embassy',
    level: 'any',
    countries: ['Haiti'],
    fields: ['entrepreneurship', 'innovation', 'technology'],
    description: 'Business incubation and funding for young entrepreneurs in Haiti. Provides mentorship, training, and seed funding.',
    deadline: 'Rolling — check orangecorners.nl for active cohorts.',
    url: 'https://orangecorners.nl',
    tags: ['Haiti', 'entrepreneurship', 'innovation', 'funding'],
  },
  {
    name: 'Chevening Scholarship',
    provider: 'UK Government (FCDO)',
    level: 'graduate',
    countries: ['United Kingdom'],
    fields: ['any'],
    description: "UK government's global scholarship programme for outstanding scholars. Covers tuition, living costs, airfare, and visa fees for a one-year master's degree.",
    deadline: 'Typically November each year for the following academic year.',
    url: 'https://www.chevening.org',
    tags: ['UK', 'fully funded', 'master', 'leadership'],
  },
  {
    name: 'Eiffel Excellence Scholarship (France)',
    provider: 'Campus France / French Government',
    level: 'graduate',
    countries: ['France'],
    fields: ['engineering', 'economics', 'law', 'political science'],
    description: "French government scholarship for international master's and PhD students. Covers monthly allowance, accommodation, and airfare.",
    deadline: 'Typically January each year.',
    url: 'https://www.campusfrance.org/en/eiffel-scholarship-program-of-excellence',
    tags: ['France', 'fully funded', 'master', 'PhD', 'engineering'],
  },
  {
    name: 'DAAD Scholarship (Germany)',
    provider: 'German Academic Exchange Service',
    level: 'graduate',
    countries: ['Germany'],
    fields: ['any'],
    description: 'German government scholarships for international graduate students. Multiple programs available including fully funded options.',
    deadline: 'Varies by program — check DAAD portal.',
    url: 'https://www.daad.de/en/',
    tags: ['Germany', 'graduate', 'research', 'PhD'],
  },
  {
    name: 'Aga Khan Foundation International Scholarship',
    provider: 'Aga Khan Foundation',
    level: 'graduate',
    countries: ['multiple'],
    fields: ['any'],
    description: 'Scholarships for students from developing countries pursuing postgraduate studies. Half-grant, half-loan structure.',
    deadline: 'Typically March each year.',
    url: 'https://www.akdn.org/our-agencies/aga-khan-foundation/international-scholarship-programme',
    tags: ['developing countries', 'graduate', 'need-based'],
  },
  {
    name: 'MasterCard Foundation Scholars Program',
    provider: 'MasterCard Foundation',
    level: 'undergraduate',
    countries: ['multiple partner universities'],
    fields: ['any'],
    description: 'Fully funded undergraduate scholarships at partner universities for academically talented young Africans and students from developing regions.',
    deadline: 'Varies by institution.',
    url: 'https://mastercardfdn.org/all/scholars/',
    tags: ['undergraduate', 'fully funded', 'Africa', 'developing'],
  },
  {
    name: 'EdLight News — External Scholarships Roundup',
    provider: 'EdLight News',
    level: 'any',
    countries: ['international'],
    fields: ['any'],
    description: 'EdLight News regularly curates and publishes external scholarship and funding opportunities for learners in Haiti and the Caribbean. Visit EdLight News for the latest listings.',
    deadline: 'Updated regularly.',
    url: 'https://news.edlight.org/bourses',
    tags: ['EdLight News', 'Haiti', 'curated', 'scholarships', 'latest'],
  },
];

const searchScholarshipsTool: SandraTool = {
  name: 'searchScholarships',
  description:
    "Search for scholarship and educational funding opportunities. Use when the user asks about scholarships, grants, fellowships, bursaries, financial aid, or funding opportunities for education. Returns curated scholarships relevant to learners in Haiti and the Caribbean.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keywords', default: 'scholarship funding opportunity' },
      field: { type: 'string', description: 'Field of study, e.g. "engineering", "medicine"' },
      country: { type: 'string', description: 'Target country, e.g. "France", "United States"' },
      level: {
        type: 'string',
        enum: ['undergraduate', 'graduate', 'phd', 'any'],
        description: 'Academic level',
        default: 'any',
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: [],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    // Filter the static catalogue
    let results = SCHOLARSHIP_CATALOGUE;

    if (params.level && params.level !== 'any') {
      results = results.filter((s) => s.level === params.level || s.level === 'any');
    }

    if (params.country) {
      const c = params.country.toLowerCase();
      results = results.filter((s) =>
        s.countries.some((sc) => sc.toLowerCase().includes(c)) ||
        s.tags.some((t) => t.toLowerCase().includes(c)),
      );
    }

    if (params.field) {
      const f = params.field.toLowerCase();
      results = results.filter((s) =>
        s.fields.includes('any') ||
        s.fields.some((sf) => sf.toLowerCase().includes(f)) ||
        s.tags.some((t) => t.toLowerCase().includes(f)),
      );
    }

    // Supplement with live knowledge search
    let knowledgeResults: Array<{ title: string; content: string; source?: string }> = [];
    try {
      const kr = await searchPlatformKnowledge(params.query ?? 'scholarship funding opportunity', { topK: 3 });
      knowledgeResults = kr.map((r) => ({
        title: r.chunk.title ?? '',
        content: r.chunk.content ?? '',
        source: r.chunk.sourceId,
      }));
    } catch {
      // Knowledge search is best-effort
    }

    return {
      success: true,
      data: {
        message: results.length > 0
          ? `Found ${results.length} scholarship opportunity(ies) matching your criteria.`
          : 'No exact matches found — showing all available scholarships.',
        scholarships: results.length > 0 ? results : SCHOLARSHIP_CATALOGUE.slice(0, 5),
        knowledgeResults: knowledgeResults.length > 0 ? knowledgeResults : undefined,
        tip: 'For the most up-to-date scholarship listings, visit https://news.edlight.org/bourses',
      },
    };
  },
};

toolRegistry.register(searchScholarshipsTool);
export { searchScholarshipsTool };
