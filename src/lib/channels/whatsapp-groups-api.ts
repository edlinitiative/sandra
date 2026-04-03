/**
 * WhatsApp Groups API — programmatic group management via Meta Business Messaging.
 *
 * Implements the WhatsApp Business Cloud API Groups endpoints:
 *   POST   /{phoneNumberId}/groups            — Create a group
 *   GET    /{phoneNumberId}/groups            — List active groups
 *   GET    /{groupId}?fields=...             — Get group info
 *   GET    /{groupId}/invite_link            — Get (or reset) invite link
 *   DELETE /{groupId}/participants           — Remove participants
 *
 * Note: Groups are invite-only. Participants cannot be directly added; instead
 * an invite link is generated and sent to users. The Meta Groups API requires
 * an Official Business Account (OBA).
 *
 * Max participants per group: 8
 * Max groups per business number: 10,000
 *
 * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference/
 */

import { env } from '@/lib/config';
import { createLogger } from '@/lib/utils';

const log = createLogger('channels:whatsapp-groups-api');

// ─── Types ───────────────────────────────────────────────────────────────────

export type JoinApprovalMode = 'auto_approve' | 'approval_required';

export interface CreateGroupInput {
  /** Group subject / name. Max 128 characters. */
  subject: string;
  /** Optional description. Max 2048 characters. */
  description?: string;
  /**
   * Whether users need approval before joining.
   * Use 'approval_required' when you want to vet members (e.g. ESLP applicants).
   * Defaults to 'auto_approve'.
   */
  joinApprovalMode?: JoinApprovalMode;
}

export interface CreateGroupResult {
  /** The group ID (used for all subsequent group operations). */
  groupId: string;
  /** Invite link participants use to join. */
  inviteLink: string;
  subject: string;
  description?: string;
  joinApprovalMode: JoinApprovalMode;
}

export interface GroupInfo {
  groupId: string;
  subject: string;
  description?: string;
  suspended: boolean;
  creationTimestamp?: number;
  totalParticipantCount: number;
  participants: string[]; // WA IDs
  joinApprovalMode: JoinApprovalMode;
}

export interface ActiveGroup {
  groupId: string;
  subject: string;
  createdAt: string;
}

export interface ActiveGroupsResult {
  groups: ActiveGroup[];
  nextPageToken?: string;
}

export interface RemoveParticipantsResult {
  removed: string[];
  failed: Array<{ user: string; error: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function apiBase(): string {
  return `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;
}

function accessToken(): string {
  const token = env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not configured.');
  return token;
}

function phoneNumberId(): string {
  const id = env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not configured.');
  return id;
}

async function waGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${apiBase()}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp Groups API GET ${path} failed: ${res.status} — ${body}`);
  }

  return res.json() as Promise<T>;
}

async function waPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`WhatsApp Groups API POST ${path} failed: ${res.status} — ${errBody}`);
  }

  return res.json() as Promise<T>;
}

async function waDelete<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`WhatsApp Groups API DELETE ${path} failed: ${res.status} — ${errBody}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new WhatsApp group.
 *
 * After creation, immediately fetches the invite link so the caller can
 * send it to prospective members. The invite link is delivered both in
 * the API response and via a `group_lifecycle_update` webhook.
 */
export async function createGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
  const pid = phoneNumberId();
  log.info('Creating WhatsApp group', { subject: input.subject });

  const created = await waPost<{ id: string }>(`/${pid}/groups`, {
    messaging_product: 'whatsapp',
    subject: input.subject,
    ...(input.description ? { description: input.description } : {}),
    join_approval_mode: input.joinApprovalMode ?? 'auto_approve',
  });

  const groupId = created.id;
  log.info('WhatsApp group created', { groupId, subject: input.subject });

  // Fetch the invite link immediately
  const linkData = await getGroupInviteLink(groupId);

  return {
    groupId,
    inviteLink: linkData,
    subject: input.subject,
    description: input.description,
    joinApprovalMode: input.joinApprovalMode ?? 'auto_approve',
  };
}

/**
 * Get the current invite link for an existing group.
 */
export async function getGroupInviteLink(groupId: string): Promise<string> {
  log.info('Getting group invite link', { groupId });

  const data = await waGet<{ messaging_product: string; invite_link: string }>(
    `/${groupId}/invite_link`,
  );

  return data.invite_link;
}

/**
 * Reset the invite link for a group (invalidates all previous links).
 */
export async function resetGroupInviteLink(groupId: string): Promise<string> {
  log.info('Resetting group invite link', { groupId });

  const data = await waPost<{ messaging_product: string; invite_link: string }>(
    `/${groupId}/invite_link`,
    { messaging_product: 'whatsapp' },
  );

  return data.invite_link;
}

/**
 * List all active groups for the configured business phone number.
 */
export async function listGroups(limit = 25, afterCursor?: string): Promise<ActiveGroupsResult> {
  const pid = phoneNumberId();
  log.info('Listing WhatsApp groups', { pid });

  const params: Record<string, string> = { limit: String(limit) };
  if (afterCursor) params.after = afterCursor;

  const data = await waGet<{
    data: { groups: Array<{ id: string; subject: string; created_at: string }> };
    paging?: { cursors?: { after?: string } };
  }>(`/${pid}/groups`, params);

  return {
    groups: (data.data?.groups ?? []).map((g) => ({
      groupId: g.id,
      subject: g.subject,
      createdAt: g.created_at,
    })),
    nextPageToken: data.paging?.cursors?.after,
  };
}

/**
 * Get detailed info about a specific group.
 */
export async function getGroupInfo(groupId: string): Promise<GroupInfo> {
  log.info('Getting group info', { groupId });

  const data = await waGet<{
    messaging_product: string;
    id: string;
    subject: string;
    description?: string;
    suspended: boolean;
    creation_timestamp?: number;
    total_participant_count: number;
    participants: Array<{ wa_id: string }>;
    join_approval_mode: JoinApprovalMode;
  }>(`/${groupId}`, {
    fields: 'subject,description,suspended,creation_timestamp,total_participant_count,participants,join_approval_mode',
  });

  return {
    groupId: data.id,
    subject: data.subject,
    description: data.description,
    suspended: data.suspended,
    creationTimestamp: data.creation_timestamp,
    totalParticipantCount: data.total_participant_count,
    participants: (data.participants ?? []).map((p) => p.wa_id),
    joinApprovalMode: data.join_approval_mode,
  };
}

/**
 * Remove one or more participants from a group.
 * Note: removed participants cannot rejoin via the existing invite link.
 */
export async function removeGroupParticipants(
  groupId: string,
  users: string[],
): Promise<RemoveParticipantsResult> {
  log.info('Removing group participants', { groupId, count: users.length });

  const data = await waDelete<{
    messaging_product: string;
    removed_participants?: Array<{ user: string }>;
    failed_participants?: Array<{ user: string; errors: Array<{ message: string }> }>;
  }>(`/${groupId}/participants`, {
    messaging_product: 'whatsapp',
    participants: users.map((u) => ({ user: u })),
  });

  return {
    removed: (data.removed_participants ?? []).map((p) => p.user),
    failed: (data.failed_participants ?? []).map((p) => ({
      user: p.user,
      error: p.errors?.[0]?.message ?? 'Unknown error',
    })),
  };
}

/**
 * Send a plain-text WhatsApp message to a group.
 * The `to` field should be the group ID.
 */
export async function sendGroupTextMessage(groupId: string, text: string): Promise<string> {
  const pid = phoneNumberId();
  log.info('Sending message to WhatsApp group', { groupId });

  const data = await waPost<{ messages: Array<{ id: string }> }>(`/${pid}/messages`, {
    messaging_product: 'whatsapp',
    to: groupId,
    type: 'text',
    text: { body: text, preview_url: false },
  });

  const messageId = data.messages?.[0]?.id ?? '';
  log.info('Group message sent', { groupId, messageId });
  return messageId;
}

/**
 * Send a WhatsApp invite link to an individual user (by phone number).
 * This is a plain text message — the user taps the link to join.
 */
export async function sendInviteLinkToUser(
  phoneNumber: string,
  inviteLink: string,
  groupSubject: string,
  personalNote?: string,
): Promise<void> {
  const pid = phoneNumberId();

  const body = personalNote
    ? `${personalNote}\n\nJoin our WhatsApp group "${groupSubject}" here:\n${inviteLink}`
    : `You've been invited to join the WhatsApp group "${groupSubject}":\n\n${inviteLink}`;

  log.info('Sending group invite link to user', {
    phone: `${phoneNumber.slice(0, 4)}****`,
    groupSubject,
  });

  await waPost<unknown>(`/${pid}/messages`, {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'text',
    text: { body, preview_url: false },
  });
}
