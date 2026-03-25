import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';

const inputSchema = z.object({
  platform: z
    .enum(['academy', 'code', 'news', 'initiative', 'all'])
    .optional()
    .default('all')
    .describe("Which EdLight platform to get contact info/links for, or 'all'"),
});

type EdLightPlatform = 'academy' | 'code' | 'news' | 'initiative';

type PlatformInfo = {
  name: string;
  platform: EdLightPlatform;
  role: string;
  website: string;
  github: string;
  applicationLink: string | null;
  contact: string | null;
  social: Record<string, string>;
};

const PLATFORM_INFO: PlatformInfo[] = [
  {
    name: 'EdLight Initiative',
    platform: 'initiative',
    role: 'Organizational hub — programs, scholarships, leadership development, and community coordination',
    website: 'https://www.edlight.org/initiative',
    github: 'https://github.com/edlinitiative/EdLight-Initiative',
    applicationLink: 'https://www.edlight.org/initiative',
    contact: 'contact@edlight.org',
    social: {
      twitter: 'https://twitter.com/edlinitiative',
      linkedin: 'https://linkedin.com/company/edlinitiative',
    },
  },
  {
    name: 'EdLight Academy',
    platform: 'academy',
    role: 'Academic learning — free courses in math, physics, economics, leadership, and exam prep for students in Haiti',
    website: 'https://www.edlight.org/academy',
    github: 'https://github.com/edlinitiative/EdLight-Academy',
    applicationLink: null,
    contact: null,
    social: {},
  },
  {
    name: 'EdLight Code',
    platform: 'code',
    role: 'Coding education — Python, SQL, web development, and programming fundamentals',
    website: 'https://www.edlight.org/code',
    github: 'https://github.com/edlinitiative/code',
    applicationLink: null,
    contact: null,
    social: {},
  },
  {
    name: 'EdLight News',
    platform: 'news',
    role: 'Community news hub — announcements, event coverage, program updates, and community stories',
    website: 'https://www.edlight.org/news',
    github: 'https://github.com/edlinitiative/EdLight-News',
    applicationLink: null,
    contact: null,
    social: {},
  },
];

const getContactInfo: SandraTool = {
  name: 'getContactInfo',
  description:
    "Get official links, websites, and contact information for EdLight platforms. Use this when users ask for EdLight's website, how to contact EdLight, where to apply, or direct links to a specific platform.",
  parameters: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        description: "Which EdLight platform to get info for, or 'all'",
        enum: ['academy', 'code', 'news', 'initiative', 'all'],
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['knowledge:read'],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    const filtered =
      params.platform === 'all'
        ? PLATFORM_INFO
        : PLATFORM_INFO.filter((p) => p.platform === params.platform);

    return {
      success: true,
      data: {
        platforms: filtered,
        total: filtered.length,
        primaryContact: 'contact@edlight.org',
        applicationHub: 'https://www.edlight.org/initiative',
        note: 'For program applications, scholarships, and general inquiries, the EdLight Initiative page is the main entry point.',
      },
    };
  },
};

toolRegistry.register(getContactInfo);
export { getContactInfo };
