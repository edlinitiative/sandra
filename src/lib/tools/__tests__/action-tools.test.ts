/**
 * Tests for Phase 10 action tools:
 *   recommendCourses, createLead, submitInterestForm, queueReminder, draftEmail
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockEnqueueAction = vi.fn();
const mockLogAuditEvent = vi.fn();
const mockProgramApplicationCreate = vi.fn();

vi.mock('@/lib/actions/queue', () => ({
  enqueueAction: (...args: unknown[]) => mockEnqueueAction(...args),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('@/lib/db', () => ({
  db: {
    programApplication: {
      create: (...args: unknown[]) => mockProgramApplicationCreate(...args),
    },
  },
}));

// Rate limiter: always allow to avoid flakiness
vi.mock('@/lib/actions/rate-limiter', () => ({
  actionRateLimiter: {
    consume:    vi.fn().mockReturnValue(true),
    isAllowed:  vi.fn().mockReturnValue(true),
    remaining:  vi.fn().mockReturnValue(10),
    reset:      vi.fn(),
    resetAll:   vi.fn(),
  },
}));

// ─── Import tools (self-register) ────────────────────────────────────────────

import '@/lib/tools/recommend-courses';
import '@/lib/tools/create-lead';
import '@/lib/tools/submit-interest-form';
import '@/lib/tools/queue-reminder';
import '@/lib/tools/draft-email';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Contexts ────────────────────────────────────────────────────────────────

const anonContext: ToolContext = {
  sessionId: 'sess-anon',
  scopes:    ['knowledge:read'],
};

const userContext: ToolContext = {
  sessionId: 'sess-1',
  userId:    'user-1',
  scopes:    ['knowledge:read', 'actions:submit'],
};

// ─── recommendCourses ─────────────────────────────────────────────────────────

describe('recommendCourses', () => {
  const tool = toolRegistry.get('recommendCourses')!;

  it('is registered', () => {
    expect(tool).toBeDefined();
  });

  it('requires knowledge:read scope', () => {
    expect(tool.requiredScopes).toContain('knowledge:read');
  });

  it('returns up to 3 recommendations for a valid interest', async () => {
    const result = await tool.handler({ interest: 'web development' }, anonContext);
    expect(result.success).toBe(true);
    const data = result.data as { recommendations: unknown[] };
    expect(Array.isArray(data.recommendations)).toBe(true);
    expect(data.recommendations.length).toBeGreaterThan(0);
    expect(data.recommendations.length).toBeLessThanOrEqual(3);
  });

  it('returns results when no interest is specified', async () => {
    const result = await tool.handler({}, anonContext);
    expect(result.success).toBe(true);
  });

  it('includes callToAction and languageNote at the top level', async () => {
    const result = await tool.handler({ interest: 'python' }, anonContext);
    expect(result.success).toBe(true);
    const data = result.data as { callToAction: string; languageNote: string; recommendations: unknown[] };
    expect(data).toHaveProperty('callToAction');
    expect(data).toHaveProperty('languageNote');
    expect(typeof data.callToAction).toBe('string');
    expect(typeof data.languageNote).toBe('string');
  });

  it('returns rate-limit error when isAllowed returns false', async () => {
    const { actionRateLimiter } = await import('@/lib/actions/rate-limiter');
    (actionRateLimiter.isAllowed as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const result = await tool.handler({ interest: 'anything' }, anonContext);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ─── createLead ───────────────────────────────────────────────────────────────

describe('createLead', () => {
  const tool = toolRegistry.get('createLead')!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueAction.mockResolvedValue({
      queued: true, actionId: 'lead-1', requiresApproval: false, status: 'executed', message: 'recorded',
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it('is registered', () => expect(tool).toBeDefined());

  it('requires actions:submit scope', () => {
    expect(tool.requiredScopes).toContain('actions:submit');
  });

  it('enqueues action with requiresApproval=false', async () => {
    const result = await tool.handler({ interest: 'EdLight Code' }, userContext);
    expect(result.success).toBe(true);
    expect(mockEnqueueAction).toHaveBeenCalledOnce();
    const enqueueArg = mockEnqueueAction.mock.calls[0]![0];
    expect(enqueueArg.requiresApproval).toBe(false);
    expect(enqueueArg.tool).toBe('createLead');
  });

  it('logs an audit event', async () => {
    await tool.handler({ interest: 'EdLight Code' }, userContext);
    expect(mockLogAuditEvent).toHaveBeenCalledOnce();
  });

  it('returns actionId in response', async () => {
    const result = await tool.handler({ interest: 'something' }, userContext);
    const data = result.data as { actionId: string };
    expect(data.actionId).toBe('lead-1');
  });

  it('returns rate-limit error when consume returns false', async () => {
    const { actionRateLimiter } = await import('@/lib/actions/rate-limiter');
    (actionRateLimiter.consume as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const result = await tool.handler({ interest: 'anything' }, userContext);
    expect(result.success).toBe(false);
  });
});

// ─── submitInterestForm ───────────────────────────────────────────────────────

describe('submitInterestForm', () => {
  const tool = toolRegistry.get('submitInterestForm')!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueAction.mockResolvedValue({
      queued: true, actionId: 'app-1', requiresApproval: false, status: 'executed', message: 'recorded',
    });
    mockProgramApplicationCreate.mockResolvedValue({ id: 'db-app-1' });
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it('is registered', () => expect(tool).toBeDefined());
  it('requires actions:submit scope', () => expect(tool.requiredScopes).toContain('actions:submit'));

  it('creates a programApplication record when userId is set', async () => {
    await tool.handler({ programName: 'EdLight Academy' }, userContext);
    expect(mockProgramApplicationCreate).toHaveBeenCalledOnce();
  });

  it('does NOT create a programApplication record for anonymous users', async () => {
    await tool.handler({ programName: 'EdLight Academy' }, anonContext);
    expect(mockProgramApplicationCreate).not.toHaveBeenCalled();
  });

  it('always enqueues an action', async () => {
    await tool.handler({ programName: 'EdLight Academy' }, anonContext);
    expect(mockEnqueueAction).toHaveBeenCalledOnce();
  });

  it('returns success with actionId', async () => {
    const result = await tool.handler({ programName: 'EdLight Code' }, userContext);
    expect(result.success).toBe(true);
    const data = result.data as { actionId: string };
    expect(data.actionId).toBe('app-1');
  });
});

// ─── queueReminder ────────────────────────────────────────────────────────────

describe('queueReminder', () => {
  const tool = toolRegistry.get('queueReminder')!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueAction.mockResolvedValue({
      queued: true, actionId: 'rem-1', requiresApproval: false, status: 'executed', message: 'recorded',
    });
  });

  it('is registered', () => expect(tool).toBeDefined());
  it('requires actions:submit scope', () => expect(tool.requiredScopes).toContain('actions:submit'));

  it('enqueues a reminder with the correct tool name', async () => {
    await tool.handler({ message: 'Sign up for the workshop!' }, userContext);
    expect(mockEnqueueAction).toHaveBeenCalledOnce();
    const arg = mockEnqueueAction.mock.calls[0]![0];
    expect(arg.tool).toBe('queueReminder');
  });

  it('accepts a custom deliverAt ISO string', async () => {
    const deliverAt = new Date(Date.now() + 3_600_000).toISOString();
    const result = await tool.handler({ message: 'Custom time reminder', deliverAt }, userContext);
    expect(result.success).toBe(true);
  });

  it('clamps a deliverAt in the past to ~60s from now', async () => {
    const pastDate = new Date(Date.now() - 10_000).toISOString();
    const result = await tool.handler({ message: 'Past reminder', deliverAt: pastDate }, userContext);
    // Handler clamps to at-least-60s-from-now rather than rejecting
    expect(result.success).toBe(true);
    const data = result.data as { deliverAt: string };
    const deliverTs = new Date(data.deliverAt).getTime();
    expect(deliverTs).toBeGreaterThan(Date.now() + 50_000); // clipped forward
  });

  it('clamps deliverAt beyond 30 days to 30 days', async () => {
    const tooFar = new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString();
    await tool.handler({ message: 'Far-future reminder', deliverAt: tooFar }, userContext);
    const arg = mockEnqueueAction.mock.calls[0]![0];
    const actualDeliverAt = new Date(arg.input.deliverAt as string).getTime();
    const thirtyDays = Date.now() + 30 * 24 * 3600 * 1000;
    expect(actualDeliverAt).toBeLessThanOrEqual(thirtyDays + 5000); // small tolerance
  });
});

// ─── draftEmail ───────────────────────────────────────────────────────────────

describe('draftEmail', () => {
  const tool = toolRegistry.get('draftEmail')!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueAction.mockResolvedValue({
      queued: true, actionId: 'email-1', requiresApproval: true, status: 'pending', message: 'queued for review',
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it('is registered', () => expect(tool).toBeDefined());
  it('requires actions:submit scope', () => expect(tool.requiredScopes).toContain('actions:submit'));

  it('enqueues with requiresApproval=true (human-in-the-loop)', async () => {
    const result = await tool.handler(
      { to: 'contact@school.edu', subject: 'Inquiry', body: 'Hello, I would like to know more.' },
      userContext,
    );
    expect(result.success).toBe(true);
    const arg = mockEnqueueAction.mock.calls[0]![0];
    expect(arg.requiresApproval).toBe(true);
  });

  it('includes status=pending_approval in response', async () => {
    const result = await tool.handler(
      { to: 'a@b.com', subject: 'Hello', body: 'Hello there, testing this out.' },
      userContext,
    );
    const data = result.data as { status: string };
    expect(data.status).toBe('pending_approval');
  });

  it('logs an audit event', async () => {
    await tool.handler(
      { to: 'x@y.com', subject: 'Test Subject', body: 'This is the body content.' },
      userContext,
    );
    expect(mockLogAuditEvent).toHaveBeenCalledOnce();
  });

  it('returns actionId in response', async () => {
    const result = await tool.handler(
      { to: 'z@w.com', subject: 'Check-in', body: 'Just checking in with you.' },
      userContext,
    );
    const data = result.data as { actionId: string };
    expect(data.actionId).toBe('email-1');
  });

  it('returns rate-limit error when consume returns false', async () => {
    const { actionRateLimiter } = await import('@/lib/actions/rate-limiter');
    (actionRateLimiter.consume as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const result = await tool.handler(
      { to: 'a@b.com', subject: 'Blocked', body: 'This should be rate-limited.' },
      userContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('throws for a body that is too long (Zod validation)', async () => {
    const longBody = 'x'.repeat(4001);
    await expect(
      tool.handler(
        { to: 'a@b.com', subject: 'Too long', body: longBody },
        userContext,
      ),
    ).rejects.toThrow();
  });
});
