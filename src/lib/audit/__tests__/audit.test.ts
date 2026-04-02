/**
 * Tests for the audit logging service.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
const mockCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });
const mockFindMany = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import { logAuditEvent, getAuditLogsByUserId, getAuditLogsBySessionId } from '../logger';

describe('logAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an audit log entry', async () => {
    await logAuditEvent({
      userId: 'user-1',
      sessionId: 'session-1',
      action: 'tool_execution',
      resource: 'getUserEnrollments',
      details: { duration: 50 },
      success: true,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        action: 'tool_execution',
        resource: 'getUserEnrollments',
        success: true,
      }),
    });
  });

  it('handles null userId gracefully', async () => {
    await logAuditEvent({
      action: 'auth_failure',
      resource: '/api/chat',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        sessionId: null,
        action: 'auth_failure',
        resource: '/api/chat',
        success: true,
      }),
    });
  });

  it('does not throw on DB errors (best-effort)', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB down'));

    // Should not throw
    await expect(
      logAuditEvent({ action: 'test', success: true }),
    ).resolves.toBeUndefined();
  });
});

describe('getAuditLogsByUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries audit logs for a user', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'audit-1',
        userId: 'user-1',
        sessionId: null,
        action: 'tool_execution',
        resource: 'getUserProfile',
        details: null,
        ip: null,
        success: true,
        createdAt: new Date(),
      },
    ]);

    const logs = await getAuditLogsByUserId('user-1');
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe('tool_execution');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('respects limit parameter', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await getAuditLogsByUserId('user-1', { limit: 10 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it('clamps limit to 200', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await getAuditLogsByUserId('user-1', { limit: 999 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });
});

describe('getAuditLogsBySessionId', () => {
  it('queries audit logs for a session', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await getAuditLogsBySessionId('session-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 'session-1' },
      }),
    );
  });
});
