/**
 * Tests for Phase 14 EdLight Academic tools:
 *   searchScholarships, checkApplicationDeadline, getLearningPath,
 *   trackLearningProgress, submitApplication, requestCertificate
 *
 * Tests for Phase 14 Reminder & Task tools:
 *   listReminders, cancelReminder, listTasks
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockEnqueueAction        = vi.fn().mockResolvedValue({ id: 'action-1' });
const mockLogAuditEvent        = vi.fn().mockResolvedValue(undefined);

// Google context / tasks (for listTasks)
const mockResolveTenantForUser = vi.fn().mockResolvedValue('tenant-1');
const mockResolveGoogleContext = vi.fn().mockResolvedValue({ tenantId: 'tenant-1' });
const mockListTasks            = vi.fn();

// Rate limiter
const mockRateLimiterConsume = vi.fn().mockReturnValue(true);

// DB
const mockEnrollmentFindMany      = vi.fn();
const mockCertificateFindMany     = vi.fn();
const mockApplicationCreate       = vi.fn();
const mockApplicationFindFirst    = vi.fn();
const mockActionRequestFindMany   = vi.fn();
const mockActionRequestFindFirst  = vi.fn();
const mockActionRequestUpdate     = vi.fn();
const mockUserFindUnique          = vi.fn();

vi.mock('@/lib/actions/queue', () => ({
  enqueueAction: (...a: unknown[]) => mockEnqueueAction(...a),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/knowledge', () => ({
  searchPlatformKnowledge: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext:  (...a: unknown[]) => mockResolveGoogleContext(...a),
  resolveTenantForUser:  (...a: unknown[]) => mockResolveTenantForUser(...a),
}));

vi.mock('@/lib/google/tasks', () => ({
  listTasks:    (...a: unknown[]) => mockListTasks(...a),
  createTask:   vi.fn(),
  completeTask: vi.fn(),
  deleteTask:   vi.fn(),
}));

vi.mock('@/lib/actions/rate-limiter', () => ({
  actionRateLimiter: {
    consume: (...a: unknown[]) => mockRateLimiterConsume(...a),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    enrollment: {
      findMany: (...a: unknown[]) => mockEnrollmentFindMany(...a),
    },
    certificate: {
      findMany: (...a: unknown[]) => mockCertificateFindMany(...a),
    },
    programApplication: {
      create:     (...a: unknown[]) => mockApplicationCreate(...a),
      findFirst:  (...a: unknown[]) => mockApplicationFindFirst(...a),
    },
    actionRequest: {
      findMany:   (...a: unknown[]) => mockActionRequestFindMany(...a),
      findFirst:  (...a: unknown[]) => mockActionRequestFindFirst(...a),
      update:     (...a: unknown[]) => mockActionRequestUpdate(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
  },
}));

// ─── Import tools ─────────────────────────────────────────────────────────────

import '@/lib/tools/search-scholarships';
import '@/lib/tools/check-application-deadline';
import '@/lib/tools/get-learning-path';
import '@/lib/tools/track-learning-progress';
import '@/lib/tools/submit-application';
import '@/lib/tools/request-certificate';
import '@/lib/tools/list-reminders';
import '@/lib/tools/cancel-reminder';
import '@/lib/tools/list-tasks';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Contexts ────────────────────────────────────────────────────────────────

const ctx: ToolContext = {
  sessionId: 'sess-1',
  userId:    'user-1',
  scopes:    ['profile:read', 'actions:submit', 'tasks:write'],
};

const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockResolveGoogleContext.mockResolvedValue({ tenantId: 'tenant-1' });
  mockRateLimiterConsume.mockReturnValue(true);
});

// ─── searchScholarships ───────────────────────────────────────────────────────

describe('searchScholarships', () => {
  const tool = toolRegistry.get('searchScholarships')!;

  it('is registered with no required scopes (public)', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toHaveLength(0);
  });

  it('returns scholarship list for anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(true);
    const data = result.data as { scholarships: unknown[] };
    expect(data.scholarships.length).toBeGreaterThan(0);
  });

  it('filters scholarships by field', async () => {
    const result = await tool.handler({ field: 'technology' }, anonCtx);
    expect(result.success).toBe(true);
  });

  it('filters scholarships by level', async () => {
    const result = await tool.handler({ level: 'undergraduate' }, anonCtx);
    expect(result.success).toBe(true);
    const data = result.data as { scholarships: Array<{ level: string }> };
    expect(data.scholarships.every((s) => s.level === 'undergraduate' || s.level === 'any')).toBe(true);
  });

  it('falls back to full catalogue when no matches', async () => {
    const result = await tool.handler({ field: 'alchemy' }, anonCtx);
    expect(result.success).toBe(true);
    const data = result.data as { scholarships: unknown[] };
    expect(data.scholarships.length).toBeGreaterThan(0);
  });
});

// ─── checkApplicationDeadline ─────────────────────────────────────────────────

describe('checkApplicationDeadline', () => {
  const tool = toolRegistry.get('checkApplicationDeadline')!;

  it('is registered with no required scopes (public)', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toHaveLength(0);
  });

  it('returns all deadlines when no program specified', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(true);
    const data = result.data as { deadlines: unknown[] };
    expect(data.deadlines.length).toBeGreaterThan(0);
  });

  it('returns matching deadline for a specific program', async () => {
    // 'ESLP' is a known abbreviation in the static data
    const result = await tool.handler({ program: 'ESLP' }, anonCtx);
    expect(result.success).toBe(true);
    const data = result.data as { deadlines: Array<{ program: string }> };
    expect(data.deadlines.length).toBeGreaterThan(0);
  });

  it('includes daysRemaining and isUrgent in each entry', async () => {
    const result = await tool.handler({}, anonCtx);
    const data = result.data as { deadlines: Array<{ isUrgent: boolean; daysRemaining: number | null }> };
    expect(data.deadlines.every((d) => typeof d.isUrgent === 'boolean')).toBe(true);
    expect(data.deadlines.every((d) => d.daysRemaining === null || typeof d.daysRemaining === 'number')).toBe(true);
  });
});

// ─── getLearningPath ──────────────────────────────────────────────────────────

describe('getLearningPath', () => {
  const tool = toolRegistry.get('getLearningPath')!;

  it('is registered with no required scopes (public)', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toHaveLength(0);
  });

  it('rejects missing goal', async () => {
    await expect(tool.handler({}, anonCtx)).rejects.toThrow();
  });

  it('returns a learning path for a known goal', async () => {
    const result = await tool.handler({ goal: 'web development' }, anonCtx);
    expect(result.success).toBe(true);
    // Response shape: { goal, recommendedPath, description, totalHours, steps, ... }
    const data = result.data as { steps: unknown[] };
    expect(data.steps.length).toBeGreaterThan(0);
  });

  it('returns a generic path for unknown goals', async () => {
    const result = await tool.handler({ goal: 'quantum physics' }, anonCtx);
    expect(result.success).toBe(true);
    // Falls back to 'web-development' default
    const data = result.data as { recommendedPath: string };
    expect(typeof data.recommendedPath).toBe('string');
  });
});

// ─── trackLearningProgress ────────────────────────────────────────────────────

describe('trackLearningProgress', () => {
  const tool = toolRegistry.get('trackLearningProgress')!;

  it('is registered with profile:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns progress summary from DB', async () => {
    // Tool maps e.courseName, e.platform, e.status, e.enrolledAt, e.completedAt
    mockEnrollmentFindMany.mockResolvedValueOnce([
      { courseName: 'Web Dev Bootcamp', platform: 'code',    status: 'active',    enrolledAt: new Date(), completedAt: null },
      { courseName: 'Data Science 101', platform: 'academy', status: 'completed', enrolledAt: new Date(), completedAt: new Date() },
    ]);
    // Tool maps c.courseName, c.platform, c.issuedAt, c.certificateUrl
    mockCertificateFindMany.mockResolvedValueOnce([
      { courseName: 'Data Science 101', platform: 'academy', issuedAt: new Date(), certificateUrl: 'https://certs.edlight.org/1' },
    ]);

    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as {
      summary: { active: number; completed: number; certificates: number };
      enrollments: unknown[];
      certificates: unknown[];
    };
    // summary has { active, completed, certificates } — no 'total' field
    expect(data.summary.active).toBe(1);
    expect(data.summary.completed).toBe(1);
    expect(data.summary.certificates).toBe(1);
    expect(data.certificates).toHaveLength(1);
  });
});

// ─── submitApplication ────────────────────────────────────────────────────────

describe('submitApplication', () => {
  const tool = toolRegistry.get('submitApplication')!;

  it('is registered with actions:submit scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('actions:submit');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({ programName: 'Test' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('creates an application and enqueues notification', async () => {
    mockApplicationFindFirst.mockResolvedValueOnce(null);
    mockApplicationCreate.mockResolvedValueOnce({
      id: 'app-1', programName: 'ESENCIA Fellowship', userId: 'user-1',
      status: 'submitted', appliedAt: new Date(),
    });

    const result = await tool.handler({ programName: 'ESENCIA Fellowship' }, ctx);
    expect(result.success).toBe(true);
    expect(mockEnqueueAction).toHaveBeenCalled();
    const data = result.data as { applicationId: string };
    expect(data.applicationId).toBe('app-1');
  });

  it('rejects duplicate applications', async () => {
    // existing.appliedAt must be a real Date so .toISOString() doesn't crash
    mockApplicationFindFirst.mockResolvedValueOnce({
      id: 'existing-app', status: 'submitted', appliedAt: new Date('2026-01-01'),
    });
    const result = await tool.handler({ programName: 'ESENCIA' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('already');
  });
});

// ─── requestCertificate ───────────────────────────────────────────────────────

describe('requestCertificate', () => {
  const tool = toolRegistry.get('requestCertificate')!;

  it('is registered with profile:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('profile:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns existing certificates', async () => {
    // Tool uses c.courseName, c.platform, c.issuedAt, c.certificateUrl
    mockCertificateFindMany.mockResolvedValueOnce([
      { courseName: 'Web Dev', platform: 'code', issuedAt: new Date(), certificateUrl: 'https://certs.edlight.org/1' },
    ]);
    mockEnrollmentFindMany.mockResolvedValueOnce([]);

    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { certificates: unknown[] };
    expect(data.certificates).toHaveLength(1);
  });

  it('identifies completed enrollments missing certificates', async () => {
    mockCertificateFindMany.mockResolvedValueOnce([]);
    // Tool uses e.courseName, e.platform, e.completedAt
    mockEnrollmentFindMany.mockResolvedValueOnce([
      { courseName: 'Data Science', platform: 'academy', status: 'completed', completedAt: new Date() },
    ]);

    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { pendingCertificates: unknown[] };
    expect(data.pendingCertificates.length).toBeGreaterThan(0);
  });
});

// ─── listReminders ────────────────────────────────────────────────────────────

describe('listReminders', () => {
  const tool = toolRegistry.get('listReminders')!;

  it('is registered with actions:submit scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('actions:submit');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns pending reminders', async () => {
    // Tool uses a.requestedAt (not a.createdAt) and a.input fields
    mockActionRequestFindMany.mockResolvedValueOnce([
      {
        id: 'ar-1', tool: 'queueReminder', status: 'pending', channel: 'whatsapp',
        input: { message: 'Team meeting', deliverAt: '2026-04-10T09:00:00Z' },
        requestedAt: new Date(),
      },
    ]);

    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { reminders: unknown[]; message: string };
    expect(data.reminders).toHaveLength(1);
    expect(data.message).toContain('1');
  });

  it('filters by status', async () => {
    mockActionRequestFindMany.mockResolvedValueOnce([]);
    // Valid status enum values: 'pending' | 'executed' | 'all'
    await tool.handler({ status: 'executed' }, ctx);
    expect(mockActionRequestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'executed' }),
      }),
    );
  });
});

// ─── cancelReminder ───────────────────────────────────────────────────────────

describe('cancelReminder', () => {
  const tool = toolRegistry.get('cancelReminder')!;

  it('is registered with actions:submit scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('actions:submit');
  });

  it('rejects missing reminderId', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('cancels the reminder and returns confirmation', async () => {
    // Tool does: findFirst → check → update
    mockActionRequestFindFirst.mockResolvedValueOnce({
      id: 'ar-1', status: 'pending', input: { message: 'Team meeting' },
    });
    mockActionRequestUpdate.mockResolvedValueOnce({ id: 'ar-1', status: 'rejected' });

    const result = await tool.handler({ reminderId: 'ar-1' }, ctx);
    expect(result.success).toBe(true);
    expect(mockActionRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'ar-1' }),
        data:  expect.objectContaining({ status: 'rejected' }),
      }),
    );
  });

  it('returns error when reminder not found', async () => {
    mockActionRequestFindFirst.mockResolvedValueOnce(null);
    const result = await tool.handler({ reminderId: 'nonexistent' }, ctx);
    expect(result.success).toBe(false);
  });

  it('returns error when reminder already executed', async () => {
    mockActionRequestFindFirst.mockResolvedValueOnce({
      id: 'ar-1', status: 'executed', input: { message: 'Old reminder' },
    });
    const result = await tool.handler({ reminderId: 'ar-1' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('already been delivered');
  });
});

// ─── listTasks ────────────────────────────────────────────────────────────────

describe('listTasks', () => {
  const tool = toolRegistry.get('listTasks')!;

  it('is registered with tasks:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('tasks:write');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns tasks list on success', async () => {
    // Tool calls db.user.findUnique first, then resolveGoogleContext, then listTasks
    mockUserFindUnique.mockResolvedValueOnce({ email: 'user@test.org' });
    mockListTasks.mockResolvedValueOnce([
      { id: 'task-1', title: 'Review PR',   status: 'needsAction', due: '2026-04-05' },
      { id: 'task-2', title: 'Write tests', status: 'completed',   due: '2026-04-10' },
    ]);

    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { tasks: Array<{ id: string }>; count: number };
    expect(data.count).toBe(2);
    expect(data.tasks[0].id).toBe('task-1');
  });

  it('filters to active tasks only by default', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ email: 'user@test.org' });
    mockListTasks.mockResolvedValueOnce([
      { id: 'task-1', title: 'Review PR', status: 'needsAction', due: null },
    ]);

    // Tool parameter is 'showCompleted', not 'includeCompleted'
    const result = await tool.handler({ showCompleted: false }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { tasks: Array<{ status: string }> };
    expect(data.tasks.every((t) => t.status !== 'completed')).toBe(true);
  });
});
