/**
 * Tests for the action queue module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    actionRequest: {
      create:     (...args: unknown[]) => mockCreate(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      findMany:   (...args: unknown[]) => mockFindMany(...args),
      count:      (...args: unknown[]) => mockCount(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('@/lib/utils', () => ({
  createLogger: () => ({
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks
import {
  enqueueAction,
  approveAction,
  rejectAction,
  listActions,
  getActionById,
} from '../queue';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date('2026-03-27T12:00:00Z');

function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:               'action-1',
    userId:           'user-1',
    sessionId:        'sess-1',
    channel:          'web',
    tool:             'createLead',
    input:            { name: 'Alice' },
    status:           'executed',
    requiresApproval: false,
    requestedAt:      now,
    reviewedAt:       null,
    reviewedBy:       null,
    reviewNote:       null,
    result:           null,
    metadata:         null,
    createdAt:        now,
    updatedAt:        now,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('enqueueAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a record with status=executed when requiresApproval=false', async () => {
    mockCreate.mockResolvedValueOnce(makeRecord({ status: 'executed', requiresApproval: false }));

    const result = await enqueueAction({
      sessionId:        'sess-1',
      channel:          'web',
      tool:             'createLead',
      input:            { name: 'Alice' },
      requiresApproval: false,
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const callData = mockCreate.mock.calls[0]![0].data;
    expect(callData.status).toBe('executed');
    expect(result.queued).toBe(true);
    expect(result.status).toBe('executed');
    expect(result.requiresApproval).toBe(false);
    expect(result.actionId).toBe('action-1');
  });

  it('creates a record with status=pending when requiresApproval=true', async () => {
    mockCreate.mockResolvedValueOnce(makeRecord({ id: 'action-2', status: 'pending', requiresApproval: true }));

    const result = await enqueueAction({
      sessionId:        'sess-1',
      channel:          'web',
      tool:             'draftEmail',
      input:            { to: 'a@b.com', subject: 'Hi', body: 'Hello' },
      requiresApproval: true,
    });

    const callData = mockCreate.mock.calls[0]![0].data;
    expect(callData.status).toBe('pending');
    expect(callData.requiresApproval).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.message).toContain('queued for review');
  });

  it('stores metadata when provided', async () => {
    mockCreate.mockResolvedValueOnce(makeRecord({ metadata: { foo: 'bar' } }));

    await enqueueAction({
      sessionId:        'sess-1',
      channel:          'web',
      tool:             'queueReminder',
      input:            { message: 'test' },
      requiresApproval: false,
      metadata:         { foo: 'bar' },
    });

    const callData = mockCreate.mock.calls[0]![0].data;
    expect(callData.metadata).toEqual({ foo: 'bar' });
  });
});

describe('approveAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets status=approved with reviewedBy and optional note', async () => {
    const record = makeRecord({ status: 'approved', reviewedBy: 'admin@edlight.org', reviewNote: 'Looks good' });
    mockUpdate.mockResolvedValueOnce(record);

    const entry = await approveAction('action-1', 'admin@edlight.org', 'Looks good');

    const callData = mockUpdate.mock.calls[0]![0];
    expect(callData.where.id).toBe('action-1');
    expect(callData.data.status).toBe('approved');
    expect(callData.data.reviewedBy).toBe('admin@edlight.org');
    expect(callData.data.reviewNote).toBe('Looks good');
    expect(entry.status).toBe('approved');
  });

  it('sets reviewNote to null when no note provided', async () => {
    mockUpdate.mockResolvedValueOnce(makeRecord({ status: 'approved', reviewedBy: 'admin', reviewNote: null }));

    await approveAction('action-1', 'admin');

    const callData = mockUpdate.mock.calls[0]![0];
    expect(callData.data.reviewNote).toBeNull();
  });
});

describe('rejectAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets status=rejected with reviewedBy and reason', async () => {
    const record = makeRecord({ status: 'rejected', reviewedBy: 'admin', reviewNote: 'Not allowed' });
    mockUpdate.mockResolvedValueOnce(record);

    const entry = await rejectAction('action-1', 'admin', 'Not allowed');

    const callData = mockUpdate.mock.calls[0]![0];
    expect(callData.data.status).toBe('rejected');
    expect(callData.data.reviewNote).toBe('Not allowed');
    expect(entry.status).toBe('rejected');
  });
});

describe('listActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated actions and total', async () => {
    mockFindMany.mockResolvedValueOnce([makeRecord()]);
    mockCount.mockResolvedValueOnce(1);

    const { actions, total } = await listActions({ limit: 10, offset: 0 });

    expect(actions).toHaveLength(1);
    expect(total).toBe(1);
  });

  it('applies status filter', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    await listActions({ status: 'pending' });

    const where = mockFindMany.mock.calls[0]![0].where;
    expect(where.status).toBe('pending');
  });

  it('applies tool filter', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    await listActions({ tool: 'draftEmail' });

    const where = mockFindMany.mock.calls[0]![0].where;
    expect(where.tool).toBe('draftEmail');
  });

  it('applies userId filter', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    await listActions({ userId: 'user-42' });

    const where = mockFindMany.mock.calls[0]![0].where;
    expect(where.userId).toBe('user-42');
  });

  it('caps limit at 100', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    await listActions({ limit: 9999 });

    const take = mockFindMany.mock.calls[0]![0].take;
    expect(take).toBe(100);
  });
});

describe('getActionById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an entry for an existing action', async () => {
    mockFindUnique.mockResolvedValueOnce(makeRecord());

    const entry = await getActionById('action-1');

    expect(entry).not.toBeNull();
    expect(entry!.id).toBe('action-1');
    expect(entry!.tool).toBe('createLead');
  });

  it('returns null when action does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const entry = await getActionById('no-such-id');
    expect(entry).toBeNull();
  });
});
