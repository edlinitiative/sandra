/**
 * Audit logging service.
 *
 * Logs tool executions, permission denials, authentication events,
 * and sensitive data access to the AuditLog table.
 */
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';

const log = createLogger('audit');

export type AuditAction =
  | 'tool_execution'
  | 'permission_denied'
  | 'auth_failure'
  | 'data_access'
  | 'admin_action';

export interface AuditLogInput {
  userId?: string;
  sessionId?: string;
  action: AuditAction | string;
  resource?: string;
  details?: Record<string, unknown>;
  ip?: string;
  success?: boolean;
}

/**
 * Write an audit log entry. Best-effort — never throws.
 */
export async function logAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        action: input.action,
        resource: input.resource ?? null,
        details: input.details ? (input.details as Prisma.InputJsonValue) : Prisma.DbNull,
        ip: input.ip ?? null,
        success: input.success ?? true,
      },
    });
  } catch (error) {
    log.warn('Failed to write audit log', {
      action: input.action,
      resource: input.resource,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/**
 * Query audit logs for a user.
 */
export async function getAuditLogsByUserId(
  userId: string,
  options?: { limit?: number; offset?: number },
): Promise<AuditLogEntry[]> {
  const limit = Math.min(options?.limit ?? 50, 200);
  const offset = options?.offset ?? 0;

  const rows = await db.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return rows.map(toEntry);
}

/**
 * Query audit logs for a session.
 */
export async function getAuditLogsBySessionId(
  sessionId: string,
  options?: { limit?: number },
): Promise<AuditLogEntry[]> {
  const limit = Math.min(options?.limit ?? 50, 200);

  const rows = await db.auditLog.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return rows.map(toEntry);
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  sessionId: string | null;
  action: string;
  resource: string | null;
  details: unknown;
  ip: string | null;
  success: boolean;
  createdAt: Date;
}

function toEntry(row: {
  id: string;
  userId: string | null;
  sessionId: string | null;
  action: string;
  resource: string | null;
  details: unknown;
  ip: string | null;
  success: boolean;
  createdAt: Date;
}): AuditLogEntry {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    action: row.action,
    resource: row.resource,
    details: row.details,
    ip: row.ip,
    success: row.success,
    createdAt: row.createdAt,
  };
}
