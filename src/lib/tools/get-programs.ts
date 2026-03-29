import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import {
  extractHighlights,
  extractProgramMatches,
  listGroundingSources,
  searchPlatformKnowledge,
} from '@/lib/knowledge';

const inputSchema = z.object({
  type: z
    .enum(['leadership', 'exchange', 'education', 'coding', 'innovation', 'all'])
    .optional()
    .default('all')
    .describe("Filter by program type: 'leadership' (ESLP), 'exchange' (Nexus), 'education' (Academy), 'coding' (Code), 'innovation' (Labs), or 'all'."),
  open: z
    .boolean()
    .optional()
    .describe('When true, return only currently open/accepting programs'),
});

type ProgramType = 'leadership' | 'exchange' | 'education' | 'coding' | 'innovation';
type ProgramEntry = {
  name: string;
  type: ProgramType;
  organization: string;
  description: string;
  eligibility: string;
  duration: string;
  language: string[];
  applicationUrl: string;
  highlights: string[];
  status: 'open' | 'closed' | 'upcoming';
  deadline: string;
  cost: string;
  contact: string;
  sourcePath?: string;
};

/**
 * Real program data sourced from edlight.org (scraped June 2025).
 * When the vector DB is running, this fallback data is enriched/replaced by indexed content.
 */
const PROGRAMS: ProgramEntry[] = [
  // ── ESLP (Leadership) ────────────────────────────────────────────────────────
  {
    name: 'EdLight Summer Leadership Program (ESLP)',
    type: 'leadership',
    organization: 'EdLight Initiative',
    description:
      'ESLP is a 2-week summer program for students aged 15–18 in Haitian high schools. Launched in August 2022, it develops leadership, critical thinking, and professional skills through intensive seminars, a capstone challenge week with mentor-paired teams, and speakers from institutions like Harvard, MIT, Microsoft, Deutsche Bank, and Cornell. Approximately 30 students per cohort are selected through a competitive application process.',
    eligibility: 'Students aged 15–18 currently enrolled in a Haitian high school',
    duration: '2 weeks (summer)',
    language: ['en', 'fr', 'ht'],
    applicationUrl: 'https://www.edlight.org/eslp',
    highlights: [
      'Fully funded — tuition-free, all-inclusive (meals, materials, excursions)',
      'Curriculum: Personal Discovery, Professional Orientation, College Admissions & Scholarships, Finance, Entrepreneurship',
      'Capstone Challenge Week with mentor-paired teams',
      'Speakers from Harvard, MIT, Microsoft, Deutsche Bank, Cornell',
      'Approximately 30 students per cohort, highly competitive selection',
      'Application requires: form, two essays, ID picture, transcripts',
    ],
    status: 'upcoming',
    deadline: 'ESLP 2026 dates have not yet been announced — check edlight.org/eslp for updates',
    cost: 'Free (fully funded)',
    contact: 'eslp@edlight.org',
  },
  // ── Nexus (Exchange) ─────────────────────────────────────────────────────────
  {
    name: 'EdLight Nexus',
    type: 'exchange',
    organization: 'EdLight Initiative',
    description:
      'EdLight Nexus is a global exchange and immersion program designed for Haitian university students. Fellows participate in 7-day residencies across 6+ international destinations including France, Spain, Canada, the United States, Panama, and the Dominican Republic. Since launch, 48 fellows from 10+ Haitian cities have participated. Three pathways are available: Academic Immersion, Leadership & Policy, and Culture & Creative Industries.',
    eligibility: 'Haitian university students',
    duration: '7-day residencies',
    language: ['en', 'fr', 'ht'],
    applicationUrl: 'https://www.edlight.org/nexus',
    highlights: [
      '7-day residencies in 6+ international destinations',
      '48 fellows since launch, representing 10+ Haitian cities',
      '70% average scholarship coverage',
      'Estimated total ~$1,250 (excluding flights & visa fees)',
      '3 pathways: Academic Immersion, Leadership & Policy, Culture & Creative Industries',
      'Featured residency: Barcelona Mobility at ESADE Business School',
      '4-phase journey: Discover → Prepare → Immerse → Amplify',
    ],
    status: 'upcoming',
    deadline: 'Next Nexus cohort has not yet been announced — check edlight.org/nexus for updates',
    cost: 'Approximately $1,250 total (excl. flights & visa); 70% average scholarship coverage available',
    contact: 'nexus@edlight.org',
  },
  // ── Academy (Education) ──────────────────────────────────────────────────────
  {
    name: 'EdLight Academy',
    type: 'education',
    organization: 'EdLight Initiative',
    description:
      'EdLight Academy is a free online learning platform offering 500+ video lessons for Haitian students. Courses are bilingual (Haitian Creole and French), self-paced, mobile-friendly, and available 24/7. The curriculum is aligned with Haitian national exams and covers Maths, Physics, Chemistry, Economics, and Languages & Communication.',
    eligibility: 'Open to all — designed for Haitian high school students',
    duration: 'Self-paced, always available',
    language: ['fr', 'ht'],
    applicationUrl: 'https://academy.edlight.org',
    highlights: [
      '500+ free video lessons',
      'Bilingual: Haitian Creole and French',
      'Subjects: Maths, Physics, Chemistry, Economics, Languages & Communication',
      'Curriculum aligned with Haitian national exams',
      'Self-paced, mobile-friendly, accessible 24/7',
    ],
    status: 'open',
    deadline: 'Always open — no application required',
    cost: 'Free',
    contact: 'academy@edlight.org',
  },
  // ── Code (Coding Education) ──────────────────────────────────────────────────
  {
    name: 'EdLight Code',
    type: 'coding',
    organization: 'EdLight Initiative',
    description:
      'EdLight Code is a free, browser-based coding education platform with 6+ learning tracks. Courses cover SQL (6 courses, ~60 hours), Python (7 courses, ~55 hours), Terminal & Git (3 courses, ~9 hours), HTML (3 courses, ~12 hours), CSS (3 courses, ~14 hours), and JavaScript (3 courses, ~14 hours). Learners earn verifiable certificates with unique URLs upon completion. Available in English, French, and Haitian Creole.',
    eligibility: 'Open to all — no prior coding experience required for beginner tracks',
    duration: 'Self-paced; ~164 total hours of content across all tracks',
    language: ['en', 'fr', 'ht'],
    applicationUrl: 'https://code.edlight.org',
    highlights: [
      '6+ learning tracks: SQL, Python, Terminal & Git, HTML, CSS, JavaScript',
      'Free and browser-based — no installation needed',
      'Verifiable certificates with unique URLs',
      'Multilingual: English, French, Haitian Creole',
      'SQL: 6 courses (~60h), Python: 7 courses (~55h), Terminal & Git: 3 courses (~9h)',
      'HTML: 3 courses (~12h), CSS: 3 courses (~14h), JavaScript: 3 courses (~14h)',
    ],
    status: 'open',
    deadline: 'Always open — no application required',
    cost: 'Free',
    contact: 'code@edlight.org',
  },
  // ── Labs (Innovation) ────────────────────────────────────────────────────────
  {
    name: 'EdLight Labs',
    type: 'innovation',
    organization: 'EdLight Initiative',
    description:
      'EdLight Labs builds digital products, websites, and innovation pilots for mission-led organizations. Services include website & product design, full-stack development (Next.js, React, TypeScript), care & optimization, and innovation lab sprints. Labs also runs maker labs introducing 3D printing and fabrication to Haitian classrooms, and mentorship pipelines pairing student developers with real-world client projects. 25+ digital builds launched with an average 8-week go-live timeline and 92% client retention.',
    eligibility: 'Organizations seeking digital products; students and technologists seeking mentorship and portfolio experience',
    duration: 'Average 6–8 week engagement (Impact Website Accelerator)',
    language: ['en', 'fr', 'ht'],
    applicationUrl: 'https://www.edlight.org/labs',
    highlights: [
      '25+ digital builds launched for schools, nonprofits, and startups',
      'Average 8-week go-live timeline, 92% client retention',
      'Services: website design, full-stack development, care & optimization, innovation sprints',
      'Tech stack: Next.js, React, TypeScript, headless CMS',
      'Maker labs introducing 3D printing to Haitian classrooms',
      'Mentorship pipelines pairing student developers with real client projects',
      'Signature offering: Impact Website Accelerator (6–8 week sprint)',
    ],
    status: 'open',
    deadline: 'Ongoing — reach out to start a project brief',
    cost: 'Custom pricing; transparent scopes and flexible payment plans',
    contact: 'labs@edlight.org',
  },
];

const getProgramsAndScholarships: SandraTool = {
  name: 'getProgramsAndScholarships',
  description:
    'Get information about EdLight programs and opportunities. EdLight runs 5 programs: ESLP (leadership, high school), Nexus (exchange, university), Academy (free video lessons), Code (free coding courses), and Labs (digital products & innovation). Use this for questions about programs, applications, deadlines, and eligibility. EdLight does NOT offer its own scholarships — for external scholarships, direct users to EdLight News.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: "Filter by program type: 'leadership' (ESLP), 'exchange' (Nexus), 'education' (Academy), 'coding' (Code), 'innovation' (Labs), or 'all'.",
        enum: ['leadership', 'exchange', 'education', 'coding', 'innovation', 'all'],
      },
      open: {
        type: 'boolean',
        description: 'When true, return only currently open/accepting programs',
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['knowledge:read'],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const query =
      params.type === 'leadership'
        ? 'leadership programs ESLP application'
        : 'programs leadership ESLP opportunities';
    const groundedResults = await searchPlatformKnowledge(query, {
      platform: 'initiative',
      contentType: 'program',
      preferPaths: ['README.md', 'docs/', 'program', 'leadership', 'ESLP'],
      topK: 8,
    });
    const extractedPrograms = extractProgramMatches(groundedResults);
    const normalizedExtractedPrograms = extractedPrograms.map((program) => ({
      ...program,
      normalizedName: normalizeName(program.name),
    }));

    const groundedPrograms: Array<ProgramEntry | null> = PROGRAMS.map((program) => {
      const programName = normalizeName(program.name);
      const groundedProgram = normalizedExtractedPrograms.find((candidate) =>
        candidate.normalizedName === programName ||
        candidate.normalizedName.includes(programName) ||
        programName.includes(candidate.normalizedName),
      );

      if (!groundedProgram) {
        return null;
      }

      return {
        ...program,
        type: groundedProgram.type as ProgramType,
        description: groundedProgram.description,
        sourcePath: groundedProgram.path,
      };
    });

    let filtered: ProgramEntry[] = extractedPrograms.length > 0
      ? groundedPrograms.filter((program): program is ProgramEntry => program !== null)
      : PROGRAMS;

    if (params.type && params.type !== 'all') {
      filtered = filtered.filter((p) => p.type === params.type);
    }

    if (params.open) {
      filtered = filtered.filter((p) => p.status === 'open');
    }

    return {
      success: true,
      data: {
        programs: filtered.map((p) => ({
          name: p.name,
          type: p.type,
          organization: p.organization,
          description: p.description,
          eligibility: p.eligibility,
          duration: p.duration,
          highlights: p.highlights,
          status: p.status,
          deadline: p.deadline,
          cost: p.cost,
          applicationUrl: p.applicationUrl,
          languages: p.language,
          contact: p.contact,
          sourcePath: p.sourcePath,
        })),
        total: filtered.length,
        types: [...new Set(filtered.map((p) => p.type))],
        grounding: extractedPrograms.length > 0 ? 'indexed' : 'fallback',
        groundingSources: listGroundingSources(groundedResults),
        highlights: extractedPrograms.length > 0 ? extractHighlights(groundedResults, 4) : [],
        note:
          extractedPrograms.length === 0
            ? 'Program data is based on publicly available information from edlight.org. Visit edlight.org for the latest details.'
            : undefined,
      },
    };
  },
};

// Auto-register
toolRegistry.register(getProgramsAndScholarships);

export { getProgramsAndScholarships };

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
