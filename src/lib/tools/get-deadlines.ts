import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';

const inputSchema = z.object({
  type: z
    .enum(['leadership', 'exchange', 'education', 'coding', 'innovation', 'all'])
    .optional()
    .default('all')
    .describe("Filter by program type: 'leadership' (ESLP), 'exchange' (Nexus), 'education' (Academy), 'coding' (Code), 'innovation' (Labs), or 'all'."),
  openOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe('When true, return only programs currently accepting applications'),
});

type ProgramType = 'leadership' | 'exchange' | 'education' | 'coding' | 'innovation';
type DeadlineStatus = 'open' | 'upcoming' | 'closed';
type DeadlineUrgency = 'always-open' | 'seasonal' | 'pending-announcement';

type DeadlineEntry = {
  program: string;
  type: ProgramType;
  status: DeadlineStatus;
  deadline: string;
  /** ISO date string for seasonal deadlines, null when not yet announced */
  deadlineDate: string | null;
  cost: string;
  applicationUrl: string;
  urgency: DeadlineUrgency;
  contact: string;
};

/**
 * Application deadline catalogue for all EdLight programs.
 * Sourced from edlight.org (scraped June 2025). Dates are updated when officially announced.
 */
const DEADLINES: DeadlineEntry[] = [
  {
    program: 'EdLight Summer Leadership Program (ESLP)',
    type: 'leadership',
    status: 'upcoming',
    deadline: 'ESLP 2026 dates have not yet been announced. Check edlight.org/eslp for updates.',
    deadlineDate: null,
    cost: 'Free (fully funded)',
    applicationUrl: 'https://www.edlight.org/eslp',
    urgency: 'pending-announcement',
    contact: 'eslp@edlight.org',
  },
  {
    program: 'EdLight Nexus',
    type: 'exchange',
    status: 'upcoming',
    deadline: 'Next Nexus cohort has not yet been announced. Check edlight.org/nexus for updates.',
    deadlineDate: null,
    cost: 'Approx. $1,250 (excl. flights & visa); 70% avg scholarship coverage',
    applicationUrl: 'https://www.edlight.org/nexus',
    urgency: 'pending-announcement',
    contact: 'nexus@edlight.org',
  },
  {
    program: 'EdLight Academy',
    type: 'education',
    status: 'open',
    deadline: 'Always open — no application required',
    deadlineDate: null,
    cost: 'Free',
    applicationUrl: 'https://academy.edlight.org',
    urgency: 'always-open',
    contact: 'academy@edlight.org',
  },
  {
    program: 'EdLight Code',
    type: 'coding',
    status: 'open',
    deadline: 'Always open — no application required',
    deadlineDate: null,
    cost: 'Free',
    applicationUrl: 'https://code.edlight.org',
    urgency: 'always-open',
    contact: 'code@edlight.org',
  },
  {
    program: 'EdLight Labs',
    type: 'innovation',
    status: 'open',
    deadline: 'Ongoing — reach out any time to start a project brief',
    deadlineDate: null,
    cost: 'Custom pricing; transparent scopes',
    applicationUrl: 'https://www.edlight.org/labs',
    urgency: 'always-open',
    contact: 'labs@edlight.org',
  },
];

const getProgramDeadlines: SandraTool = {
  name: 'getProgramDeadlines',
  description:
    'Get application deadlines for EdLight programs. Use this when users ask about when to apply, upcoming deadlines, which programs are currently accepting applications, or closing dates. Covers ESLP, Nexus, Academy, Code, and Labs.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: "Filter by type: 'leadership' (ESLP), 'exchange' (Nexus), 'education' (Academy), 'coding' (Code), 'innovation' (Labs), or 'all'.",
        enum: ['leadership', 'exchange', 'education', 'coding', 'innovation', 'all'],
      },
      openOnly: {
        type: 'boolean',
        description: 'When true, return only programs currently accepting applications',
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['knowledge:read'],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    let filtered = params.openOnly
      ? DEADLINES.filter((d) => d.status === 'open')
      : DEADLINES;

    if (params.type !== 'all') {
      filtered = filtered.filter((d) => d.type === params.type);
    }

    // Sort: seasonal (have a specific date) first, then pending, then always-open
    const sorted = [...filtered].sort((a, b) => {
      if (a.deadlineDate && b.deadlineDate) return a.deadlineDate.localeCompare(b.deadlineDate);
      if (a.deadlineDate) return -1;
      if (b.deadlineDate) return 1;
      return 0;
    });

    const alwaysOpenCount = sorted.filter((d) => d.urgency === 'always-open').length;
    const seasonalCount = sorted.filter((d) => d.urgency === 'seasonal').length;
    const pendingCount = sorted.filter((d) => d.urgency === 'pending-announcement').length;

    let tip: string;
    if (pendingCount > 0 && alwaysOpenCount > 0) {
      tip = 'Some programs (Academy, Code, Labs) are always open. ESLP and Nexus have seasonal applications — dates will be announced on edlight.org.';
    } else if (alwaysOpenCount > 0) {
      tip = 'These programs are always open — you can start any time.';
    } else if (pendingCount > 0) {
      tip = 'Application dates have not yet been announced. Check edlight.org for updates.';
    } else {
      tip = 'These programs have specific seasonal deadlines. Apply before the dates listed.';
    }

    return {
      success: true,
      data: {
        deadlines: sorted,
        total: sorted.length,
        summary: {
          alwaysOpen: alwaysOpenCount,
          seasonalDeadlines: seasonalCount,
          pendingAnnouncement: pendingCount,
        },
        tip,
        applicationHub: 'https://www.edlight.org',
        note: 'Deadline information is based on publicly available data from edlight.org. Visit the program pages for the latest details.',
      },
    };
  },
};

toolRegistry.register(getProgramDeadlines);
export { getProgramDeadlines };
