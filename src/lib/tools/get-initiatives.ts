import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { EDLIGHT_PLATFORMS } from '@/lib/config/constants';

const inputSchema = z.object({
  category: z.string().optional().describe('Filter by category: coding, news, leadership, education'),
});

// Curated initiative data for V1 — sourced from RepoRegistry + hardcoded descriptions
const INITIATIVES = [
  {
    name: 'EdLight Code',
    category: 'coding',
    repo: 'edlinitiative/code',
    url: 'https://github.com/edlinitiative/code',
    description: 'The core EdLight coding education platform — hands-on coding curriculum and learning tools for students.',
    status: 'active',
  },
  {
    name: 'EdLight Academy',
    category: 'education',
    repo: 'edlinitiative/EdLight-Academy',
    url: 'https://github.com/edlinitiative/EdLight-Academy',
    description: 'Educational platform and learning resources for the EdLight ecosystem — structured courses and tutorials.',
    status: 'active',
  },
  {
    name: 'EdLight News',
    category: 'news',
    repo: 'edlinitiative/EdLight-News',
    url: 'https://github.com/edlinitiative/EdLight-News',
    description: 'News and updates platform for the EdLight community — announcements, events, and community stories.',
    status: 'active',
  },
  {
    name: 'EdLight Initiative',
    category: 'leadership',
    repo: 'edlinitiative/EdLight-Initiative',
    url: 'https://github.com/edlinitiative/EdLight-Initiative',
    description: 'The EdLight Initiative organization and community hub — leadership programs and community building.',
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
      ? INITIATIVES.filter((i) => i.category === params.category)
      : INITIATIVES;

    return {
      success: true,
      data: {
        initiatives: filtered,
        totalPlatforms: EDLIGHT_PLATFORMS.length,
      },
    };
  },
};

toolRegistry.register(getEdLightInitiatives);

export { getEdLightInitiatives };
