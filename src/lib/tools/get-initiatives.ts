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
  category: z.string().optional().describe('Filter by category: coding, news, leadership, education'),
});

const INITIATIVES = [
  {
    name: 'EdLight Code',
    category: 'coding',
    repo: 'edlinitiative/code',
    url: 'https://github.com/edlinitiative/code',
    description:
      'The core EdLight coding education platform — hands-on coding curriculum and learning tools for students. Offers courses in Python, SQL, web development, and programming fundamentals. Designed to take learners from absolute beginner to practical coding skills.',
    focus: 'coding education',
    highlights: ['Python programming', 'SQL and databases', 'Web development (HTML/CSS/JS)', 'Beginner-to-intermediate progression'],
    status: 'active',
  },
  {
    name: 'EdLight Academy',
    category: 'education',
    repo: 'edlinitiative/EdLight-Academy',
    url: 'https://github.com/edlinitiative/EdLight-Academy',
    description:
      'Educational platform and learning resources for the EdLight ecosystem — structured courses covering digital literacy, productivity tools, and design skills. Covers Microsoft Office Suite, Excel data skills, PowerPoint, and 3D design. Ideal for learners building professional and academic competencies.',
    focus: 'accessible academic education and exam preparation',
    highlights: ['Free online courses for high school students', 'Core academic subjects such as math, physics, and economics', 'Self-paced learning accessible from anywhere', 'Educational support for Haitian students preparing for exams'],
    status: 'active',
  },
  {
    name: 'EdLight News',
    category: 'news',
    repo: 'edlinitiative/EdLight-News',
    url: 'https://github.com/edlinitiative/EdLight-News',
    description:
      'News and updates platform for the EdLight community — publishes announcements, event coverage, program updates, and community stories from across the EdLight ecosystem. Keeps learners, educators, and community members informed about new courses, initiatives, and milestones.',
    focus: 'community news and announcements',
    highlights: ['Program announcements', 'Community event coverage', 'New course launches', 'Ecosystem updates', 'Community member spotlights'],
    status: 'active',
  },
  {
    name: 'EdLight Initiative',
    category: 'leadership',
    repo: 'edlinitiative/EdLight-Initiative',
    url: 'https://github.com/edlinitiative/EdLight-Initiative',
    description:
      'The EdLight Initiative is the organizational and community hub for the entire EdLight ecosystem — it runs leadership development programs, coordinates cross-platform community building, and drives the mission of accessible education and technology for underserved communities.',
    focus: 'leadership and community organization',
    highlights: ['Leadership development programs', 'Community building and outreach', 'Cross-platform coordination', 'Mission: accessible education for underserved communities'],
    status: 'active',
  },
];

const getEdLightInitiatives: SandraTool = {
  name: 'getEdLightInitiatives',
  description:
    'Get information about EdLight initiatives and platforms. Returns details about EdLight Code, EdLight Academy, EdLight News, and EdLight Initiative.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by category: coding, news, leadership, education',
        enum: ['coding', 'news', 'leadership', 'education'],
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
    default:
      return 'initiative';
  }
}
