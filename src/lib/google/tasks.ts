/**
 * Google Tasks API — create and manage tasks.
 *
 * Tasks appear in Google Calendar's "My Tasks" sidebar and in the
 * Google Tasks app. They can optionally be linked to a calendar event date.
 *
 * Required DWD scope: https://www.googleapis.com/auth/tasks
 */

import { createLogger } from '@/lib/utils';
import { getContextToken, GOOGLE_SCOPES } from './auth';
import type { GoogleWorkspaceContext } from './types';

const log = createLogger('google:tasks');

const TASKS_API = 'https://tasks.googleapis.com/tasks/v1';
const TASKS_SCOPES = [GOOGLE_SCOPES.TASKS];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskInput {
  title: string;
  notes?: string;
  /** Due date in ISO 8601 format (date portion used, e.g. "2026-04-03") */
  dueDate?: string;
  /** Task list ID — defaults to the user's primary task list */
  taskListId?: string;
}

export interface TaskResult {
  taskId: string;
  title: string;
  status: string;
  dueDate?: string;
  taskListId: string;
  taskListTitle: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getPrimaryTaskList(
  token: string,
): Promise<{ id: string; title: string }> {
  const res = await fetch(`${TASKS_API}/users/@me/lists?maxResults=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get task lists: ${res.status} — ${body}`);
  }
  const data = await res.json() as { items?: Array<{ id: string; title: string }> };
  const list = data.items?.[0];
  if (!list) throw new Error('No task list found for this user');
  return list;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a task in the user's Google Tasks.
 */
export async function createTask(
  ctx: GoogleWorkspaceContext,
  input: TaskInput,
): Promise<TaskResult> {
  log.info('Creating task', {
    title: input.title,
    dueDate: input.dueDate,
    impersonating: ctx.impersonateEmail,
  });

  const token = await getContextToken(ctx, TASKS_SCOPES);

  // Resolve task list
  let taskListId = input.taskListId;
  let taskListTitle = 'My Tasks';
  if (!taskListId) {
    const list = await getPrimaryTaskList(token);
    taskListId = list.id;
    taskListTitle = list.title;
  }

  const body: Record<string, unknown> = {
    title: input.title,
    status: 'needsAction',
  };

  if (input.notes) body.notes = input.notes;
  if (input.dueDate) {
    // Google Tasks API requires RFC 3339 timestamp for due date
    body.due = `${input.dueDate.substring(0, 10)}T00:00:00.000Z`;
  }

  const res = await fetch(`${TASKS_API}/lists/${encodeURIComponent(taskListId)}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    log.error('Task creation failed', { status: res.status, body: errBody });
    throw new Error(`Tasks API error: ${res.status} — ${errBody}`);
  }

  const data = await res.json() as {
    id: string;
    title: string;
    status: string;
    due?: string;
  };

  log.info('Task created', { taskId: data.id, title: data.title });

  return {
    taskId: data.id,
    title: data.title,
    status: data.status,
    dueDate: data.due?.substring(0, 10),
    taskListId,
    taskListTitle,
  };
}

// ─── List / Complete / Delete ─────────────────────────────────────────────────

export interface TaskListOptions {
  /** Task list ID — defaults to primary list */
  taskListId?: string;
  /** Include completed tasks (default: false) */
  showCompleted?: boolean;
  /** Include hidden tasks */
  showHidden?: boolean;
  /** Max results (default 20) */
  maxResults?: number;
  /** RFC 3339 due min filter */
  dueMin?: string;
  /** RFC 3339 due max filter */
  dueMax?: string;
}

/**
 * List tasks from the user's Google Tasks.
 */
export async function listTasks(
  ctx: GoogleWorkspaceContext,
  options: TaskListOptions = {},
): Promise<TaskResult[]> {
  log.info('Listing tasks', { tenantId: ctx.tenantId, impersonating: ctx.impersonateEmail });

  const token = await getContextToken(ctx, TASKS_SCOPES);

  let taskListId = options.taskListId;
  let taskListTitle = 'My Tasks';
  if (!taskListId) {
    const list = await getPrimaryTaskList(token);
    taskListId = list.id;
    taskListTitle = list.title;
  }

  const url = new URL(`${TASKS_API}/lists/${encodeURIComponent(taskListId)}/tasks`);
  url.searchParams.set('maxResults', String(options.maxResults ?? 20));
  if (options.showCompleted !== undefined) url.searchParams.set('showCompleted', String(options.showCompleted));
  if (options.showHidden) url.searchParams.set('showHidden', 'true');
  if (options.dueMin) url.searchParams.set('dueMin', options.dueMin);
  if (options.dueMax) url.searchParams.set('dueMax', options.dueMax);

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tasks list failed: ${res.status} — ${body}`);
  }

  const data = await res.json() as { items?: Array<{ id: string; title: string; status: string; due?: string; notes?: string }> };
  return (data.items ?? []).map((item) => ({
    taskId: item.id,
    title: item.title,
    status: item.status,
    dueDate: item.due?.substring(0, 10),
    taskListId: taskListId!,
    taskListTitle,
  }));
}

/**
 * Mark a task as completed.
 */
export async function completeTask(
  ctx: GoogleWorkspaceContext,
  taskId: string,
  taskListId?: string,
): Promise<void> {
  log.info('Completing task', { taskId, tenantId: ctx.tenantId });

  const token = await getContextToken(ctx, TASKS_SCOPES);
  let listId = taskListId;
  if (!listId) {
    const list = await getPrimaryTaskList(token);
    listId = list.id;
  }

  const res = await fetch(`${TASKS_API}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Task complete failed: ${res.status} — ${body}`);
  }
  log.info('Task completed', { taskId });
}

/**
 * Delete a task.
 */
export async function deleteTask(
  ctx: GoogleWorkspaceContext,
  taskId: string,
  taskListId?: string,
): Promise<void> {
  log.info('Deleting task', { taskId, tenantId: ctx.tenantId });

  const token = await getContextToken(ctx, TASKS_SCOPES);
  let listId = taskListId;
  if (!listId) {
    const list = await getPrimaryTaskList(token);
    listId = list.id;
  }

  const res = await fetch(
    `${TASKS_API}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(`Task delete failed: ${res.status} — ${body}`);
  }
  log.info('Task deleted', { taskId });
}
