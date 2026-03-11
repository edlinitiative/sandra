import { z } from 'zod';
import type { SandraTool, ToolResult } from './types';
import { toolRegistry } from './registry';
import { EDLIGHT_PLATFORMS } from '@/lib/config/constants';

const inputSchema = z.object({
  platform: z.string().optional().describe('Filter by specific EdLight platform name'),
});

const getEdLightInitiatives: SandraTool = {
  name: 'getEdLightInitiatives',
  description:
    'Get information about EdLight initiatives and platforms. Returns details about EdLight Code, EdLight Academy, EdLight News, and EdLight Initiative.',
  parameters: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Filter by specific EdLight platform name' },
    },
    required: [],
  },
  inputSchema,

  async execute(input: unknown): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    // Structured knowledge about EdLight platforms
    const initiatives = [
      {
        name: 'EdLight Code',
        repo: 'edlinitiative/code',
        url: 'https://github.com/edlinitiative/code',
        description: 'The core EdLight codebase and platform.',
        status: 'active',
      },
      {
        name: 'EdLight Academy',
        repo: 'edlinitiative/EdLight-Academy',
        url: 'https://github.com/edlinitiative/EdLight-Academy',
        description: 'Educational platform and learning resources for the EdLight ecosystem.',
        status: 'active',
      },
      {
        name: 'EdLight News',
        repo: 'edlinitiative/EdLight-News',
        url: 'https://github.com/edlinitiative/EdLight-News',
        description: 'News and updates platform for the EdLight community.',
        status: 'active',
      },
      {
        name: 'EdLight Initiative',
        repo: 'edlinitiative/EdLight-Initiative',
        url: 'https://github.com/edlinitiative/EdLight-Initiative',
        description: 'The EdLight Initiative organization and community hub.',
        status: 'active',
      },
    ];

    const filtered = params.platform
      ? initiatives.filter((i) => i.name.toLowerCase().includes(params.platform!.toLowerCase()))
      : initiatives;

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
