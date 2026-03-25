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
    .enum(['leadership', 'internship', 'all'])
    .optional()
    .default('all')
    .describe("Filter by program type: 'leadership', 'internship', or 'all'"),
  open: z
    .boolean()
    .optional()
    .describe('When true, return only currently open/accepting programs'),
});

type ProgramType = 'leadership' | 'internship';
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
  status: 'open' | 'closed';
  deadline: string;
  cost: string;
  sourcePath?: string;
};

const PROGRAMS: ProgramEntry[] = [
  // ── Leadership Programs ──────────────────────────────────────────────────────
  {
    name: 'EdLight Summer Leadership Program (ESLP)',
    type: 'leadership',
    organization: 'EdLight Initiative',
    description:
      'The EdLight Summer Leadership Program (ESLP) is a flagship leadership development experience for outstanding students and young professionals in Haiti. Participants develop communication, critical thinking, project management, and leadership skills through intensive workshops, mentorship, and community projects.',
    eligibility: 'Students and young professionals in Haiti, typically ages 16–25',
    duration: '4–6 weeks (summer)',
    language: ['en', 'fr', 'ht'],
    applicationUrl: 'https://www.edlight.org/initiative',
    highlights: [
      'Intensive leadership workshops',
      'Mentorship from EdLight alumni and partners',
      'Community impact projects',
      'Networking with peers across Haiti',
      'Certificate of completion',
    ],
    status: 'open',
    deadline: 'Applications open annually in spring',
    cost: 'Free',
  },
  {
    name: 'EdLight Community Builder Program',
    type: 'leadership',
    organization: 'EdLight Initiative',
    description:
      'A community-focused leadership track for young Haitians passionate about education access and social impact. Participants work with local schools and communities to expand access to digital education.',
    eligibility: 'Young adults aged 18–30 based in Haiti',
    duration: '3 months (part-time)',
    language: ['fr', 'ht'],
    applicationUrl: 'https://www.edlight.org/initiative',
    highlights: [
      'Community outreach and education projects',
      'Digital literacy facilitation training',
      'Leadership coaching',
      'Real community impact',
    ],
    status: 'open',
    deadline: 'Rolling admissions',
    cost: 'Free',
  },

  // ── Internships / Volunteering ────────────────────────────────────────────────
  {
    name: 'EdLight Content Volunteer Program',
    type: 'internship',
    organization: 'EdLight Initiative',
    description:
      'Volunteer opportunity for educators, developers, and content creators who want to contribute to EdLight\'s course content in Haitian Creole, French, or English. Volunteers help build and translate course materials across EdLight Academy and EdLight Code.',
    eligibility: 'Educators, developers, and university students globally',
    duration: 'Flexible (minimum 1 month)',
    language: ['en', 'fr', 'ht'],
    applicationUrl: 'https://www.edlight.org/initiative',
    highlights: [
      'Contribute to accessible education for Haiti',
      'Build course content in 3 languages',
      'Work with a global team',
      'Letter of recommendation available',
      'Remote-friendly',
    ],
    status: 'open',
    deadline: 'Rolling applications',
    cost: 'Free (volunteer)',
  },
  {
    name: 'EdLight Tech Internship',
    type: 'internship',
    organization: 'EdLight Initiative',
    description:
      'Technical internship for software developers and designers who want to gain experience building real educational tools for underserved communities. Interns contribute to EdLight platforms under mentorship.',
    eligibility: 'University students and recent graduates with programming or design skills',
    duration: '2–4 months',
    language: ['en', 'fr'],
    applicationUrl: 'https://www.edlight.org/initiative',
    highlights: [
      'Real product development experience',
      'Mentorship from EdLight engineers',
      'Contribute to platforms used in Haiti',
      'Remote-first',
      'Certificate and recommendation letter',
    ],
    status: 'open',
    deadline: 'Applications reviewed on a rolling basis',
    cost: 'Free (unpaid internship)',
  },
];

const getProgramsAndScholarships: SandraTool = {
  name: 'getProgramsAndScholarships',
  description:
    'Get information about EdLight programs and opportunities. Use this for questions about leadership programs (ESLP), internships, volunteering, applications, deadlines, and eligibility. EdLight does NOT offer its own scholarships — for external scholarships, direct users to EdLight News.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: "Filter by program type: 'leadership', 'internship', or 'all'",
        enum: ['leadership', 'internship', 'all'],
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
      params.type === 'internship'
        ? 'internships volunteering application'
        : params.type === 'leadership'
          ? 'leadership programs ESLP application'
          : 'programs internships leadership opportunities';
    const groundedResults = await searchPlatformKnowledge(query, {
      platform: 'initiative',
      contentType: 'program',
      preferPaths: ['README.md', 'docs/', 'program', 'leadership', 'scholar', 'intern'],
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
          sourcePath: p.sourcePath,
        })),
        total: filtered.length,
        types: [...new Set(filtered.map((p) => p.type))],
        grounding: extractedPrograms.length > 0 ? 'indexed' : 'fallback',
        groundingSources: listGroundingSources(groundedResults),
        highlights: extractedPrograms.length > 0 ? extractHighlights(groundedResults, 4) : [],
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
