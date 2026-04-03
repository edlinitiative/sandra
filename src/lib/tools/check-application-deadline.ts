/**
 * checkApplicationDeadline — get the deadline for a specific EdLight program
 * and calculate how many days remain.
 *
 * Required scopes: public (none required)
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';

const inputSchema = z.object({
  program: z
    .string()
    .min(1)
    .describe("EdLight program name or abbreviation, e.g. 'ESLP', 'Nexus', 'Academy', 'Code', 'Labs', 'scholarship'"),
});

type DeadlineInfo = {
  program: string;
  abbreviation: string;
  status: 'open' | 'upcoming' | 'closed' | 'always-open';
  deadlineDate: string | null;
  deadlineText: string;
  daysRemaining: number | null;
  isUrgent: boolean;
  applicationUrl: string;
  cost: string;
  contact: string;
  notes: string;
};

const PROGRAM_DEADLINES: DeadlineInfo[] = [
  {
    program: 'EdLight Summer Leadership Program',
    abbreviation: 'ESLP',
    status: 'upcoming',
    deadlineDate: null,
    deadlineText: 'ESLP 2026 dates have not yet been officially announced. Check edlight.org/eslp for updates.',
    daysRemaining: null,
    isUrgent: false,
    applicationUrl: 'https://www.edlight.org/eslp',
    cost: 'Free (fully funded)',
    contact: 'eslp@edlight.org',
    notes: 'ESLP is a competitive leadership program. Applications typically open in Q1.',
  },
  {
    program: 'EdLight Nexus',
    abbreviation: 'Nexus',
    status: 'upcoming',
    deadlineDate: null,
    deadlineText: 'The next Nexus cohort has not yet been announced. Check edlight.org/nexus for updates.',
    daysRemaining: null,
    isUrgent: false,
    applicationUrl: 'https://www.edlight.org/nexus',
    cost: 'Approx. $1,250 (excl. flights & visa); ~70% average scholarship coverage',
    contact: 'nexus@edlight.org',
    notes: 'Nexus is an international exchange program for Haitian university students.',
  },
  {
    program: 'EdLight Academy',
    abbreviation: 'Academy',
    status: 'always-open',
    deadlineDate: null,
    deadlineText: 'Always open — no application required. Enroll anytime at academy.edlight.org.',
    daysRemaining: null,
    isUrgent: false,
    applicationUrl: 'https://academy.edlight.org',
    cost: 'Free',
    contact: 'academy@edlight.org',
    notes: 'Self-paced video lessons in Maths, Physics, Chemistry, Economics, and Languages.',
  },
  {
    program: 'EdLight Code',
    abbreviation: 'Code',
    status: 'always-open',
    deadlineDate: null,
    deadlineText: 'Always open — no application required. Start coding today at code.edlight.org.',
    daysRemaining: null,
    isUrgent: false,
    applicationUrl: 'https://code.edlight.org',
    cost: 'Free',
    contact: 'code@edlight.org',
    notes: 'Six learning tracks: SQL, Python, Terminal & Git, HTML, CSS, JavaScript. All browser-based.',
  },
  {
    program: 'EdLight Labs',
    abbreviation: 'Labs',
    status: 'upcoming',
    deadlineDate: null,
    deadlineText: 'The next Labs cohort application window has not been announced. Check edlight.org/labs.',
    daysRemaining: null,
    isUrgent: false,
    applicationUrl: 'https://www.edlight.org/labs',
    cost: 'Varies by project',
    contact: 'labs@edlight.org',
    notes: 'Labs connects student developers with real-world client projects.',
  },
];

function matchProgram(query: string): DeadlineInfo | undefined {
  const q = query.toLowerCase().trim();
  return PROGRAM_DEADLINES.find(
    (p) =>
      p.abbreviation.toLowerCase() === q ||
      p.program.toLowerCase().includes(q) ||
      q.includes(p.abbreviation.toLowerCase()),
  );
}

function enrichWithDaysRemaining(info: DeadlineInfo): DeadlineInfo {
  if (!info.deadlineDate) return info;
  const now = new Date();
  const deadline = new Date(info.deadlineDate);
  const diff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return {
    ...info,
    daysRemaining: diff,
    isUrgent: diff >= 0 && diff <= 14,
    status: diff < 0 ? 'closed' : 'open',
  };
}

const checkApplicationDeadlineTool: SandraTool = {
  name: 'checkApplicationDeadline',
  description:
    "Check the application deadline for a specific EdLight program and see how many days remain. Use when the user asks when they can apply, when the deadline is, or how much time they have to apply to ESLP, Nexus, Academy, Code, Labs, or any EdLight program.",
  parameters: {
    type: 'object',
    properties: {
      program: {
        type: 'string',
        description: "Program name or abbreviation: 'ESLP', 'Nexus', 'Academy', 'Code', 'Labs'",
      },
    },
    required: ['program'],
  },
  inputSchema,
  requiredScopes: [],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    const match = matchProgram(params.program);

    if (!match) {
      return {
        success: true,
        data: {
          message: `No EdLight program found matching "${params.program}". Known programs: ESLP, Nexus, Academy, Code, Labs.`,
          knownPrograms: PROGRAM_DEADLINES.map((p) => ({ name: p.program, abbreviation: p.abbreviation, url: p.applicationUrl })),
        },
      };
    }

    const enriched = enrichWithDaysRemaining(match);

    const urgencyNote = enriched.isUrgent
      ? ` ⚠️ Only ${enriched.daysRemaining} day(s) left — apply soon!`
      : enriched.daysRemaining !== null && enriched.daysRemaining < 0
      ? ' ❌ This deadline has passed.'
      : '';

    return {
      success: true,
      data: {
        program: enriched.program,
        abbreviation: enriched.abbreviation,
        status: enriched.status,
        deadlineText: enriched.deadlineText + urgencyNote,
        daysRemaining: enriched.daysRemaining,
        isUrgent: enriched.isUrgent,
        cost: enriched.cost,
        applicationUrl: enriched.applicationUrl,
        contact: enriched.contact,
        notes: enriched.notes,
      },
    };
  },
};

toolRegistry.register(checkApplicationDeadlineTool);
export { checkApplicationDeadlineTool };
