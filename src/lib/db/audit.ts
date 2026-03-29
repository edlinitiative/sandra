/**
 * Audit log data access layer.
 */
import type { PrismaClient, AuditLog } from '@prisma/client';
import { Prisma } from '@prisma/client';

export type CreateAuditLogInput = {
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  details?: Record<string, unknown>;
  ip?: string;
  success?: boolean;
};

export async function createAuditLogEntry(
  prisma: PrismaClient,
  input: CreateAuditLogInput,
): Promise<AuditLog> {
  return prisma.auditLog.create({
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
}

export async function getAuditLogs(
  prisma: PrismaClient,
  options?: {
    userId?: string;
    sessionId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  },
): Promise<AuditLog[]> {
  const limit = Math.min(options?.limit ?? 50, 200);
  const offset = options?.offset ?? 0;

  return prisma.auditLog.findMany({
    where: {
      ...(options?.userId ? { userId: options.userId } : {}),
      ...(options?.sessionId ? { sessionId: options.sessionId } : {}),
      ...(options?.action ? { action: options.action } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}
