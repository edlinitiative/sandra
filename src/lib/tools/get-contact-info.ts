import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';

const inputSchema = z.object({
  platform: z
    .enum(['academy', 'code', 'news', 'initiative', 'eslp', 'nexus', 'labs', 'all'])
    .optional()
    .default('all')
    .describe("Which EdLight platform/program to get contact info/links for, or 'all'"),
});

type EdLightPlatform = 'academy' | 'code' | 'news' | 'initiative' | 'eslp' | 'nexus' | 'labs';

type PlatformInfo = {
  name: string;
  platform: EdLightPlatform;
  role: string;
  website: string;
  github: string | null;
  applicationLink: string | null;
  contact: string;
  social: Record<string, string>;
};

/**
 * Real contact and platform information sourced from edlight.org (scraped June 2025).
 */
const PLATFORM_INFO: PlatformInfo[] = [
  {
    name: 'EdLight Initiative',
    platform: 'initiative',
    role: 'Organizational hub — the governing organization that runs all EdLight programs and coordinates the ecosystem',
    website: 'https://www.edlight.org',
    github: 'https://github.com/edlinitiative/EdLight-Initiative',
    applicationLink: 'https://www.edlight.org/get-involved',
    contact: 'info@edlight.org',
    social: {
      facebook: 'https://www.facebook.com/edlinitiative',
      twitter: 'https://x.com/edlinitiative',
      instagram: 'https://www.instagram.com/edlinitiative/',
      youtube: 'https://www.youtube.com/@edlight-initiative',
      linkedin: 'https://www.linkedin.com/company/edlight-initiative/',
    },
  },
  {
    name: 'EdLight Summer Leadership Program (ESLP)',
    platform: 'eslp',
    role: '2-week summer leadership program for Haitian high school students aged 15–18',
    website: 'https://www.edlight.org/eslp',
    github: null,
    applicationLink: 'https://www.edlight.org/eslp',
    contact: 'eslp@edlight.org',
    social: {},
  },
  {
    name: 'EdLight Nexus',
    platform: 'nexus',
    role: 'Global exchange and immersion program for Haitian university students — 7-day international residencies',
    website: 'https://www.edlight.org/nexus',
    github: null,
    applicationLink: 'https://www.edlight.org/nexus',
    contact: 'nexus@edlight.org',
    social: {},
  },
  {
    name: 'EdLight Academy',
    platform: 'academy',
    role: 'Free bilingual online learning platform — 500+ video lessons in Maths, Physics, Chemistry, Economics, Languages for Haitian students',
    website: 'https://academy.edlight.org',
    github: 'https://github.com/edlinitiative/edlight-academy',
    applicationLink: 'https://academy.edlight.org',
    contact: 'academy@edlight.org',
    social: {},
  },
  {
    name: 'EdLight Code',
    platform: 'code',
    role: 'Free browser-based coding education — 6 tracks (SQL, Python, Terminal & Git, HTML, CSS, JavaScript) with verifiable certificates',
    website: 'https://code.edlight.org',
    github: 'https://github.com/edlinitiative/edlight-code',
    applicationLink: 'https://code.edlight.org',
    contact: 'code@edlight.org',
    social: {},
  },
  {
    name: 'EdLight Labs',
    platform: 'labs',
    role: 'Digital products, websites, and innovation pilots for mission-led organizations. Also runs maker labs and student mentorship pipelines.',
    website: 'https://www.edlight.org/labs',
    github: null,
    applicationLink: 'https://www.edlight.org/labs',
    contact: 'labs@edlight.org',
    social: {},
  },
  {
    name: 'EdLight News',
    platform: 'news',
    role: 'Community news hub — announcements, event coverage, program updates, external scholarship listings, and community stories',
    website: 'https://news.edlight.org',
    github: 'https://github.com/edlinitiative/edlight-news',
    applicationLink: null,
    contact: 'info@edlight.org',
    social: {},
  },
];

const getContactInfo: SandraTool = {
  name: 'getContactInfo',
  description:
    "Get official links, websites, and contact information for EdLight platforms and programs. Use this when users ask for EdLight's website, how to contact EdLight, where to apply, or direct links. Covers: Initiative, ESLP, Nexus, Academy, Code, Labs, and News.",
  parameters: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        description: "Which EdLight platform/program to get info for, or 'all'",
        enum: ['academy', 'code', 'news', 'initiative', 'eslp', 'nexus', 'labs', 'all'],
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
        primaryContact: 'info@edlight.org',
        applicationHub: 'https://www.edlight.org',
        socialLinks: {
          facebook: 'https://www.facebook.com/edlinitiative',
          twitter: 'https://x.com/edlinitiative',
          instagram: 'https://www.instagram.com/edlinitiative/',
          youtube: 'https://www.youtube.com/@edlight-initiative',
          linkedin: 'https://www.linkedin.com/company/edlight-initiative/',
        },
        note: 'Contact information sourced from edlight.org. For the most up-to-date links, visit edlight.org directly.',
      },
    };
  },
};

toolRegistry.register(getContactInfo);
export { getContactInfo };
