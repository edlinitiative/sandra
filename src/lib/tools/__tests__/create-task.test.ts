/**
 * Tests for createTask tool.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveGoogleContext = vi.fn();
const mockResolveTenantForUser = vi.fn();
const mockCreateTask = vi.fn();
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);
const mockFindUnique = vi.fn();

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext: (...a: unknown[]) => mockResolveGoogleContext(...a),
  resolveTenantForUser: (...a: unknown[]) => mockResolveTenantForUser(...a),
}));

vi.mock('@/lib/google/tasks', () => ({
  createTask: (...a: unknown[]) => mockCreateTask(...a),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: (...a: unknown[]) => mockFindUnique(...a) },
  },
}));

// ─── Import tool ──────────────────────────────────────────────────────────────

import '@/lib/tools/create-task';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ToolContext = { sessionId: 'sess-1', userId: 'user-1', scopes: ['tasks:write'] };
const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

const googleCtx = { impersonatedEmail: 'rony@edlight.org' };
const taskResult = { taskId: 'task-123', title: 'Review proposal', dueDate: '2026-04-10' };

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockFindUnique.mockResolvedValue({ email: 'rony@edlight.org' });
  mockResolveGoogleContext.mockResolvedValue(googleCtx);
  mockCreateTask.mockResolvedValue(taskResult);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createTask', () => {
  const tool = toolRegistry.get('createTask')!;

  it('is registered with tasks:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('tasks:write');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ title: 'Test task' }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('signed in');
  });

  it('returns error when no tenant linked', async () => {
    mockResolveTenantForUser.mockResolvedValue(null);
    const result = await tool.handler({ title: 'Test task' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not linked');
  });

  it('returns error when no email found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await tool.handler({ title: 'Test task' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('creates a task and returns confirmation', async () => {
    const result = await tool.handler({
      title: 'Review proposal',
      notes: 'Check budget section',
      dueDate: '2026-04-10',
    }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.taskId).toBe('task-123');
    expect(data.title).toBe('Review proposal');
    expect((data.message as string)).toContain('Review proposal');
    expect((data.message as string)).toContain('Google Tasks');
    expect(mockCreateTask).toHaveBeenCalledWith(googleCtx, {
      title: 'Review proposal',
      notes: 'Check budget section',
      dueDate: '2026-04-10',
    });
  });

  it('assigns task to another user when assignTo provided', async () => {
    await tool.handler({
      title: 'Review PR',
      assignTo: 'ted@edlight.org',
    }, ctx);

    // Should resolve context with the assignee's email
    expect(mockResolveGoogleContext).toHaveBeenCalledWith('tenant-1', 'ted@edlight.org');
  });

  it('returns friendly error on 403', async () => {
    mockCreateTask.mockRejectedValue(new Error('HTTP 403: insufficient permissions'));
    const result = await tool.handler({ title: 'Test' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not yet enabled');
  });

  it('logs audit event on success', async () => {
    await tool.handler({ title: 'Audit test' }, ctx);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      resource: 'createTask',
      success: true,
    }));
  });
});
