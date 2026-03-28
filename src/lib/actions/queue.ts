/**
 * Action queue — database-backed action request storage.
 *
 * Actions that `requiresApproval = true` sit in status=pending until an admin
 * approves or rejects them via the /api/actions API.
 *
 * Actions with `requiresApproval = false` are immediately set to status=executed.
 */

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';
import type {
  ActionRequestEntry,
  ActionQueueResult,
  EnqueueActionInput,
  ActionStatus,
  ListActionsOptions,
} from './types';

const log = createLogger('actions:queue');

// ─── Enqueue ─────────────────────────────────────────────────────────────────

/**
 * Enqueue a new action request.
 * If `requiresApproval` is false the action is immediately marked as executed.
 */
export async function enqueueAction(
  input: EnqueueActionInput,
): Promise<ActionQueueResult> {
  const status: ActionStatus = input.requiresApproval ? 'pending' : 'executed';

  const record = await db.actionRequest.create({
    data: {
      userId:           input.userId ?? null,
      sessionId:        input.sessionId,
      channel:          input.channel,
      tool:             input.tool,
      input:            input.input as Prisma.InputJsonValue,
      status,
      requiresApproval: input.requiresApproval,
      requestedAt:      new Date(),
      metadata:         input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });

  log.info('Action enqueued', {
    id: record.id,
    tool: input.tool,
    requiresApproval: input.requiresApproval,
    status,
  });

  const message = input.requiresApproval
    ? `Your request has been queued for review (ID: ${record.id}). An EdLight administrator will process it shortly.`
    : `Your request has been recorded successfully (ID: ${record.id}).`;

  return {
    queued: true,
    actionId: record.id,
    requiresApproval: input.requiresApproval,
    status,
    message,
  };
}

// ─── Approve ─────────────────────────────────────────────────────────────────

/**
 * Approve a pending action request. Marks it as approved (or executed if no
 * further processing is needed).
 */
export async function approveAction(
  id: string,
  reviewedBy: string,
  note?: string,
): Promise<ActionRequestEntry> {
  const record = await db.actionRequest.update({
    where: { id },
    data: {
      status:     'approved',
      reviewedAt: new Date(),
      reviewedBy,
      reviewNote: note ?? null,
    },
  });

  log.info('Action approved', { id, reviewedBy });
  return toEntry(record);
}

// ─── Reject ──────────────────────────────────────────────────────────────────

/**
 * Reject a pending action request.
 */
export async function rejectAction(
  id: string,
  reviewedBy: string,
  reason?: string,
): Promise<ActionRequestEntry> {
  const record = await db.actionRequest.update({
    where: { id },
    data: {
      status:     'rejected',
      reviewedAt: new Date(),
      reviewedBy,
      reviewNote: reason ?? null,
    },
  });

  log.info('Action rejected', { id, reviewedBy });
  return toEntry(record);
}

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * List action requests with optional filters.
 */
export async function listActions(
  options: ListActionsOptions = {},
): Promise<{ actions: ActionRequestEntry[]; total: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const offset = options.offset ?? 0;

  const where: Prisma.ActionRequestWhereInput = {};
  if (options.status)  where.status  = options.status;
  if (options.tool)    where.tool    = options.tool;
  if (options.userId)  where.userId  = options.userId;

  const [rows, total] = await Promise.all([
    db.actionRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.actionRequest.count({ where }),
  ]);

  return { actions: rows.map(toEntry), total };
}

/**
 * Get a single action request by ID.
 */
export async function getActionById(id: string): Promise<ActionRequestEntry | null> {
  const record = await db.actionRequest.findUnique({ where: { id } });
  return record ? toEntry(record) : null;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function toEntry(row: {
  id: string;
  userId: string | null;
  sessionId: string | null;
  channel: string;
  tool: string;
  input: unknown;
  status: string;
  requiresApproval: boolean;
  requestedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  result: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ActionRequestEntry {
  return {
    id:               row.id,
    userId:           row.userId,
    sessionId:        row.sessionId,
    channel:          row.channel,
    tool:             row.tool,
    input:            row.input as Record<string, unknown>,
    status:           row.status as ActionStatus,
    requiresApproval: row.requiresApproval,
    requestedAt:      row.requestedAt,
    reviewedAt:       row.reviewedAt,
    reviewedBy:       row.reviewedBy,
    reviewNote:       row.reviewNote,
    result:           row.result,
    metadata:         row.metadata as Record<string, unknown> | null,
    createdAt:        row.createdAt,
    updatedAt:        row.updatedAt,
  };
}
