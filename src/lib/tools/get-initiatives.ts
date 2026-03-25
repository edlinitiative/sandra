import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { EDLIGHT_PLATFORMS } from '@/lib/config/constants';
import {
  buildGroundedDescription,
  extractHighlights,
  listGroundingSources,
  searchPlatformKnowledge,
} from '@/lib/knowledge';
import type { KnowledgePlatform } from '@/lib/knowledge';

const inputSchema = z.object({
  category: z.string().optional().describe('Filter by category: coding, news, leadership, education, exchange, innovation'),
});

/**
 * EdLight ecosystem platforms and programs — sourced from edlight.org (scraped June 2025).
 */
const INITIATIVES = [
  {
    name: 'EdLight Code',
    category: 'coding',
    repo: 'edlinitiative/edlight-code',
    url: 'https://code.edlight.org',
    description:
      'EdLight Code is a free, browser-based coding education platform with 6+ learning tracks: SQL (6 courses, ~60h), Python (7 courses, ~55h), Terminal & Git (3 courses, ~9h), HTML (3 courses, ~12h), CSS (3 courses, ~14h), and JavaScript (3 courses, ~14h). Learners earn verifiable certificates with unique URLs. Available in English, French, and Haitian Creole.',
    focus: 'coding education',
    highlights: ['6 learning tracks: SQL, Python, Terminal & Git, HTML, CSS, JavaScript', 'Free and browser-based — no installation needed', 'Verifiable certificates with unique URLs', 'Multilingual: English, French, Haitian Creole'],
    status: 'active',
  },
  {
    name: 'EdLight Academy',
    category: 'education',
    repo: 'edlinitiative/edlight-academy',
    url: 'https://academy.edlight.org',
    description:
      'EdLight Academy is a free online learning platform offering 500+ video lessons for Haitian students. Courses are bilingual (Haitian Creole and French), self-paced, mobile-friendly, and available 24/7. Curriculum aligned with Haitian national exams covering Maths, Physics, Chemistry, Economics, and Languages & Communication.',
    focus: 'accessible academic education and exam preparation',
    highlights: ['500+ free bilingual video lessons (Haitian Creole + French)', 'Subjects: Maths, Physics, Chemistry, Economics, Languages & Communication', 'Curriculum aligned with Haitian national exams', 'Self-paced, mobile-friendly, 24/7'],
    status: 'active',
  },
  {
    name: 'EdLight News',
    category: 'news',
    repo: 'edlinitiative/edlight-news',
    url: 'https://news.edlight.org',
    description:
      'News and updates platform for the EdLight community — publishes announcements, event coverage, program updates, external scholarship listings, and community stories from across the EdLight ecosystem.',
    focus: 'community news, announcements, and external scholarship curation',
    highlights: ['Program announcements and updates', 'Community event coverage', 'Curated external scholarship and opportunity listings', 'Community member spotlights'],
    status: 'active',
  },
  {
    name: 'EdLight Initiative',
    category: 'leadership',
    repo: 'edlinitiative/EdLight-Initiative',
    url: 'https://www.edlight.org',
    description:
      'The EdLight Initiative is the organizational hub for the entire EdLight ecosystem. Its mission is to make education free and accessible to all people in Haiti. It coordinates all EdLight programs (ESLP, Nexus, Academy, Code, Labs) and drives community building.',
    focus: 'organizational hub and mission coordination',
    highlights: ['Governs the entire EdLight ecosystem', 'Runs 5 programs: ESLP, Nexus, Academy, Code, Labs', 'Mission: free, accessible education for all people in Haiti', 'Community building and cross-platform coordination'],
    status: 'active',
  },
  {
    name: 'EdLight Nexus',
    category: 'exchange',
    repo: null,
    url: 'https://www.edlight.org/nexus',
    description:
      'EdLight Nexus is a global exchange and immersion program for Haitian university students. Fellows participate in 7-day residencies across 6+ destinations (France, Spain, Canada, US, Panama, Dominican Republic). 48 fellows since launch from 10+ Haitian cities. Three pathways: Academic Immersion, Leadership & Policy, Culture & Creative Industries. 70% average scholarship coverage.',
    focus: 'global exchange and immersion for university students',
    highlights: ['7-day international residencies in 6+ countries', '48 fellows since launch, 10+ Haitian cities represented', '3 pathways: Academic Immersion, Leadership & Policy, Culture & Creative Industries', '70% average scholarship coverage'],
    status: 'active',
  },
  {
    name: 'EdLight Labs',
    category: 'innovation',
    repo: null,
    url: 'https://www.edlight.org/labs',
    description:
      'EdLight Labs builds digital products, websites, and innovation pilots for mission-led organizations. Services include website & product design, full-stack development (Next.js, React, TypeScript), care & optimization, and innovation lab sprints. Also runs maker labs in Haitian classrooms and mentorship pipelines pairing student developers with real client projects. 25+ digital builds launched, 8-week average go-live, 92% client retention.',
    focus: 'digital products, innovation, and student mentorship',
    highlights: ['25+ digital builds for schools, nonprofits, and startups', 'Full-stack: Next.js, React, TypeScript', 'Maker labs introducing 3D printing to Haitian classrooms', 'Mentorship pipelines for student developers', '92% client retention'],
    status: 'active',
  },
];

const getEdLightInitiatives: SandraTool = {
  name: 'getEdLightInitiatives',
  description:
    'Get information about EdLight initiatives and platforms. Returns details about EdLight Code, Academy, News, Initiative, Nexus, and Labs — the full EdLight ecosystem.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by category: coding, news, leadership, education, exchange, innovation',
        enum: ['coding', 'news', 'leadership', 'education', 'exchange', 'innovation'],
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['repos:read'],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    const filtered = params.category
      ? INITIATIVES.filter((initiative) => initiative.category === params.category)
      : INITIATIVES;

    const groundedInitiatives = await Promise.all(
      filtered.map(async (initiative) => {
        const platform = categoryToPlatform(initiative.category);
        const results = await searchPlatformKnowledge(
          `${initiative.name} overview mission highlights`,
          {
            platform,
            contentType:
              platform === 'news'
                ? 'news'
                : platform === 'initiative'
                  ? 'program'
                  : ['documentation', 'repo_readme', 'course'],
            preferPaths:
              platform === 'initiative'
                ? ['README.md', 'docs/', 'program', 'leadership']
                : platform === 'news'
                  ? ['README.md', 'docs/', 'news', 'announcement']
                  : ['README.md', 'docs/', 'courses/'],
            topK: 4,
          },
        );

        const groundedHighlights = extractHighlights(results, 4);

        return {
          ...initiative,
          description: buildGroundedDescription(results, initiative.description),
          highlights: groundedHighlights.length > 0 ? groundedHighlights : initiative.highlights,
          grounding: results.length > 0 ? 'indexed' : 'fallback',
          groundingSources: listGroundingSources(results),
        };
      }),
    );

    return {
      success: true,
      data: {
        initiatives: groundedInitiatives.map((initiative) => ({
          name: initiative.name,
          category: initiative.category,
          repo: initiative.repo,
          url: initiative.url,
          description: initiative.description,
          focus: initiative.focus,
          highlights: initiative.highlights,
          status: initiative.status,
          grounding: initiative.grounding,
          groundingSources: initiative.groundingSources,
        })),
        totalPlatforms: EDLIGHT_PLATFORMS.length,
      },
    };
  },
};

toolRegistry.register(getEdLightInitiatives);

export { getEdLightInitiatives };

function categoryToPlatform(category: string): KnowledgePlatform {
  switch (category) {
    case 'education':
      return 'academy';
    case 'coding':
      return 'code';
    case 'news':
      return 'news';
    case 'exchange':
    case 'innovation':
    default:
      return 'initiative';
  }
}
