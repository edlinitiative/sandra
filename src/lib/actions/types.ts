/**
 * Action system type definitions.
 *
 * Actions are write-operations that Sandra can perform on behalf of a user.
 * Some actions are auto-approved (low-risk), while others require admin review
 * before execution (human-in-the-loop).
 */

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

/** A persisted ActionRequest row returned from the queue. */
export interface ActionRequestEntry {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  channel: string;
  tool: string;
  input: Record<string, unknown>;
  status: ActionStatus;
  requiresApproval: boolean;
  requestedAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  result?: unknown;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Input to enqueue a new action request. */
export interface EnqueueActionInput {
  userId?: string;
  sessionId: string;
  channel: string;
  tool: string;
  input: Record<string, unknown>;
  requiresApproval: boolean;
  metadata?: Record<string, unknown>;
}

/** Result returned after enqueuing an action. */
export interface ActionQueueResult {
  queued: boolean;
  actionId: string;
  requiresApproval: boolean;
  status: ActionStatus;
  /** Human-readable message for Sandra to relay to the user. */
  message: string;
}

/** Options for listing action requests. */
export interface ListActionsOptions {
  status?: ActionStatus;
  tool?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}
