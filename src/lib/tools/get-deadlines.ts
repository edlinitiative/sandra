import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';

const inputSchema = z.object({
  type: z
    .enum(['leadership', 'all'])
    .optional()
    .default('all')
    .describe("Filter by program type: 'leadership' or 'all'. Currently only ESLP (leadership) is available."),
  openOnly: z
    .boolean()
    .optional()
    .default(true)
    .describe('When true (default), return only currently open or rolling programs'),
});

type ProgramType = 'leadership';
type DeadlineStatus = 'open' | 'closing-soon' | 'closed';
type DeadlineUrgency = 'rolling' | 'seasonal' | 'imminent';

type DeadlineEntry = {
  program: string;
  type: ProgramType;
  status: DeadlineStatus;
  deadline: string;
  /** ISO date string for seasonal deadlines, null for rolling */
  deadlineDate: string | null;
  cost: string;
  applicationUrl: string;
  urgency: DeadlineUrgency;
};

/**
 * Application deadline catalogue for all EdLight programs.
 * Rolling programs accept applications year-round; seasonal programs have a fixed annual window.
 */
const DEADLINES: DeadlineEntry[] = [
  // ── Leadership ─────────────────────────────────────────────────────────────
  {
    program: 'EdLight Summer Leadership Program (ESLP)',
    type: 'leadership',
    status: 'open',
    deadline: 'Applications open annually in spring — submit before May',
    deadlineDate: '2026-05-01',
    cost: 'Free',
    applicationUrl: 'https://www.edlight.org/initiative',
    urgency: 'seasonal',
  },
];

const getProgramDeadlines: SandraTool = {
  name: 'getProgramDeadlines',
  description:
    'Get application deadlines for EdLight programs, scholarships, and internships. Use this when users ask about when to apply, upcoming deadlines, which programs are currently accepting applications, or closing dates.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: "Filter by type: 'leadership' or 'all'. Currently only ESLP (leadership) is available.",
        enum: ['leadership', 'all'],
      },
      openOnly: {
        type: 'boolean',
        description: 'When true (default), return only currently open programs',
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['knowledge:read'],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    let filtered = params.openOnly
      ? DEADLINES.filter((d) => d.status !== 'closed')
      : DEADLINES;

    if (params.type !== 'all') {
      filtered = filtered.filter((d) => d.type === params.type);
    }

    // Sort: seasonal (have a specific date) first, then rolling
    const sorted = [...filtered].sort((a, b) => {
      if (a.deadlineDate && b.deadlineDate) return a.deadlineDate.localeCompare(b.deadlineDate);
      if (a.deadlineDate) return -1;
      if (b.deadlineDate) return 1;
      return 0;
    });

    const rollingCount = sorted.filter((d) => d.urgency === 'rolling').length;
    const seasonalCount = sorted.filter((d) => d.urgency === 'seasonal').length;

    let tip: string;
    if (rollingCount > 0 && seasonalCount > 0) {
      tip = 'Some programs accept rolling applications year-round. Seasonal programs have specific deadlines — apply early.';
    } else if (rollingCount > 0) {
      tip = 'All currently open programs accept rolling applications — you can apply any time.';
    } else {
      tip = 'These programs have specific seasonal deadlines. Apply before the dates listed to be considered.';
    }

    return {
      success: true,
      data: {
        deadlines: sorted,
        total: sorted.length,
        summary: {
          rollingApplications: rollingCount,
          seasonalDeadlines: seasonalCount,
        },
        tip,
        applicationHub: 'https://www.edlight.org/initiative',
      },
    };
  },
};

toolRegistry.register(getProgramDeadlines);
export { getProgramDeadlines };
