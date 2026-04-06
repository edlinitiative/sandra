/**
 * Identity Linker — maps channel-specific identifiers to Workspace identities.
 *
 * Supported identifier types:
 *
 * 1. **Phone number** (WhatsApp) — matches against Workspace Directory phone fields
 * 2. **Instagram PSID** — requires self-link via email verification (no directory match)
 * 3. **Email** (web/email channels) — direct match against Workspace Directory email
 *
 * Linking strategies:
 *
 * 1. **Directory sync** — pulls phone numbers from the Workspace Directory API
 *    and builds a phone→email lookup table. Runs periodically or on-demand.
 *
 * 2. **Self-link** — a user provides "my email is user@example.com" in chat,
 *    and Sandra links their channel identity to that Workspace account.
 *
 * 3. **Direct email match** — for web/email channel users whose email is already known.
 *
 * Once linked, Sandra knows:
 *  - The user's full name, email, department, role
 *  - Whether to use their Workspace identity in group chats
 *  - Which tenant they belong to (for scoped tool access)
 */

import { db } from '@/lib/db';
import { env } from '@/lib/config';
import { createLogger } from '@/lib/utils';
import { getUserMemoryStore } from '@/lib/memory/user-memory';
import { resolveGoogleContext } from '@/lib/google/context';
import { getUserByEmail, listUsers } from '@/lib/google/directory';
import type { DirectoryUser } from '@/lib/google/types';

const log = createLogger('channels:identity-linker');

// ─── Memory Keys ─────────────────────────────────────────────────────────────

const WORKSPACE_EMAIL_KEY = 'workspace_email';
const WORKSPACE_NAME_KEY = 'workspace_name';
const WORKSPACE_LINKED_KEY = 'workspace_linked';

// ─── Phone Number Normalization ──────────────────────────────────────────────

/**
 * Normalize a phone number for matching.
 * Strips +, spaces, dashes, parens. Keeps only digits.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

// ─── Directory Phone Map ────────────────────────────────────────────────────

/** Cached mapping of normalized phone → Workspace email */
let phoneToEmailCache = new Map<string, DirectoryUser>();
let cacheUpdatedAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Build the phone→email map from the Workspace Directory.
 * Uses the full projection to get phone numbers and recovery phones.
 */
export async function syncDirectoryPhones(
  listUsersFn: () => Promise<DirectoryUser[]>,
): Promise<Map<string, DirectoryUser>> {
  log.info('Syncing directory phone numbers...');

  const users = await listUsersFn();
  const newCache = new Map<string, DirectoryUser>();

  for (const user of users) {
    if (user.phone) {
      const normalized = normalizePhone(user.phone);
      if (normalized.length >= 7) {
        newCache.set(normalized, user);
      }
    }
  }

  phoneToEmailCache = newCache;
  cacheUpdatedAt = Date.now();

  log.info('Directory phone sync complete', {
    usersScanned: users.length,
    phonesFound: newCache.size,
  });

  return newCache;
}

/**
 * Look up a Workspace user by phone number.
 * Returns null if no match found.
 */
export function findWorkspaceUserByPhone(phone: string): DirectoryUser | null {
  const normalized = normalizePhone(phone);

  // Try exact match
  const exact = phoneToEmailCache.get(normalized);
  if (exact) return exact;

  // Try suffix matching (WhatsApp sends with country code, directory might not)
  for (const [cachedPhone, user] of phoneToEmailCache) {
    if (normalized.endsWith(cachedPhone) || cachedPhone.endsWith(normalized)) {
      return user;
    }
  }

  return null;
}

/**
 * Look up a Workspace user by email address.
 * Useful for web and email channel users whose email is already known.
 */
export async function findWorkspaceUserByEmail(
  email: string,
  tenantId?: string,
): Promise<DirectoryUser | null> {
  try {
    const tid = tenantId ?? env.DEFAULT_TENANT_ID;
    if (!tid) return null;
    const ctx = await resolveGoogleContext(tid);
    return await getUserByEmail(ctx, email);
  } catch {
    return null;
  }
}

/**
 * Check if the cache is stale and needs refresh.
 */
export function isCacheStale(): boolean {
  return Date.now() - cacheUpdatedAt > CACHE_TTL_MS;
}

// ─── Directory Refresh ──────────────────────────────────────────────────────

let refreshInProgress: Promise<void> | null = null;

/**
 * Refresh the phone→email cache from the Workspace Directory.
 * De-duplicated — only one refresh runs at a time.
 */
export async function refreshPhoneCache(): Promise<void> {
  if (!isCacheStale()) return;

  // Prevent concurrent refreshes
  if (refreshInProgress) {
    await refreshInProgress;
    return;
  }

  refreshInProgress = (async () => {
    try {
      if (!env.DEFAULT_TENANT_ID) {
        log.warn('DEFAULT_TENANT_ID not configured — skipping phone cache refresh');
        return;
      }
      const ctx = await resolveGoogleContext(env.DEFAULT_TENANT_ID);
      await syncDirectoryPhones(async () => {
        const result = await listUsers(ctx, { maxResults: 200 });
        return result.users;
      });
    } catch (err) {
      log.warn('Phone cache refresh failed (non-fatal)', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    } finally {
      refreshInProgress = null;
    }
  })();

  await refreshInProgress;
}

// ─── Self-Linking ───────────────────────────────────────────────────────────

/** Pattern to detect self-link messages like "my email is x@edlight.org" */
const EMAIL_CLAIM_PATTERNS = [
  /my\s+email\s+(?:is|address\s+is)\s+(\S+@\S+\.\S+)/i,
  /(?:i'?m|i\s+am)\s+(\S+@\S+\.\S+)/i,
  /link\s+(?:me\s+(?:to|with)|my\s+(?:account|email)\s+(?:to|with)?)\s*(\S+@\S+\.\S+)/i,
];

/**
 * Check if a message contains an email self-link attempt.
 * Returns the claimed email or null.
 */
export function detectEmailClaim(text: string): string | null {
  for (const pattern of EMAIL_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      // Clean trailing punctuation
      const email = match[1].replace(/[.,;!?]+$/, '').toLowerCase();
      if (email.includes('@') && email.includes('.')) {
        return email;
      }
    }
  }
  return null;
}

// ─── Linking Operations ─────────────────────────────────────────────────────

/**
 * Link a Sandra user to their Workspace identity.
 * Stores the association in user Memory for persistence.
 */
export async function linkWorkspaceIdentity(
  userId: string,
  workspaceUser: DirectoryUser,
): Promise<void> {
  const store = getUserMemoryStore();

  await Promise.all([
    store.saveMemory(userId, {
      key: WORKSPACE_EMAIL_KEY,
      value: workspaceUser.email,
      source: 'workspace_directory',
      confidence: 1.0,
      updatedAt: new Date(),
    }),
    store.saveMemory(userId, {
      key: WORKSPACE_NAME_KEY,
      value: workspaceUser.name,
      source: 'workspace_directory',
      confidence: 1.0,
      updatedAt: new Date(),
    }),
    store.saveMemory(userId, {
      key: WORKSPACE_LINKED_KEY,
      value: 'true',
      source: 'workspace_directory',
      confidence: 1.0,
      updatedAt: new Date(),
    }),
  ]);

  // Also update the User record with the email.
  // Skip if another User already owns this email (@unique constraint would fail).
  const existingUserWithEmail = await db.user.findUnique({
    where: { email: workspaceUser.email },
    select: { id: true },
  }).catch(() => null);

  if (!existingUserWithEmail || existingUserWithEmail.id === userId) {
    await db.user.update({
      where: { id: userId },
      data: {
        email: workspaceUser.email,
        name: workspaceUser.name,
      },
    }).catch((err) => {
      log.warn('Failed to update user email', { userId, error: err instanceof Error ? err.message : 'unknown' });
    });
  } else {
    // A separate web-app User already has this email — only update the name.
    log.info('Skipping email update — web-app user already owns this email', {
      userId,
      email: workspaceUser.email,
      existingUserId: existingUserWithEmail.id,
    });
    await db.user.update({
      where: { id: userId },
      data: { name: workspaceUser.name },
    }).catch(() => { /* best-effort */ });
  }

  // Ensure the user has a TenantMember record so they can use Workspace tools.
  // Look up the tenant by the email domain (e.g. rony@edlight.org → edlight.org).
  const domain = workspaceUser.email.split('@')[1];
  if (domain) {
    const tenant = await db.tenant.findFirst({
      where: { domain },
      select: { id: true },
    }).catch(() => null);

    if (tenant) {
      // If the workspace user already has a TenantMember on the web-app User,
      // mirror that role (e.g., admin stays admin) instead of defaulting to 'basic'.
      let role: 'basic' | 'manager' | 'admin' = 'basic';
      if (existingUserWithEmail && existingUserWithEmail.id !== userId) {
        const existingMembership = await db.tenantMember.findFirst({
          where: { userId: existingUserWithEmail.id, tenantId: tenant.id, isActive: true },
          select: { role: true },
        }).catch(() => null);
        if (existingMembership?.role) {
          role = existingMembership.role;
        }
      }

      await db.tenantMember.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId } },
        create: { tenantId: tenant.id, userId, role, isActive: true },
        update: { isActive: true, role },
      }).catch((err) => {
        log.warn('Failed to upsert tenant membership', { userId, tenantId: tenant.id, error: err instanceof Error ? err.message : 'unknown' });
      });
      log.info('Ensured tenant membership', { userId, tenantId: tenant.id, domain, role });
    } else {
      log.warn('No tenant found for domain — Workspace tools may be unavailable', { userId, domain });
    }
  }

  log.info('Linked Workspace identity', {
    userId,
    email: workspaceUser.email,
    name: workspaceUser.name,
  });
}

/**
 * Get the Workspace identity for a Sandra user, if linked.
 */
export async function getWorkspaceIdentity(
  userId: string,
): Promise<{ email: string; name: string } | null> {
  const store = getUserMemoryStore();

  const [emailMem, nameMem] = await Promise.all([
    store.getMemory(userId, WORKSPACE_EMAIL_KEY),
    store.getMemory(userId, WORKSPACE_NAME_KEY),
  ]);

  if (!emailMem?.value) return null;

  return {
    email: emailMem.value,
    name: nameMem?.value ?? emailMem.value,
  };
}

/**
 * Try to auto-link a WhatsApp user to their Workspace identity.
 * Called on every inbound WhatsApp message (lightweight check).
 *
 * Returns the Workspace identity if found/linked, or null.
 */
export async function tryAutoLink(
  userId: string,
  phoneNumber: string,
): Promise<{ email: string; name: string } | null> {
  // Check if already linked
  const existing = await getWorkspaceIdentity(userId);
  if (existing) return existing;

  // Ensure the phone cache is warm
  if (isCacheStale()) {
    await refreshPhoneCache();
  }

  // Try to find by phone number in the directory cache
  const wsUser = findWorkspaceUserByPhone(phoneNumber);
  if (!wsUser) return null;

  // Auto-link!
  await linkWorkspaceIdentity(userId, wsUser);
  return { email: wsUser.email, name: wsUser.name };
}

/**
 * Try to auto-link a user to their Workspace identity based on channel type.
 * Dispatches to the appropriate lookup strategy:
 * - 'whatsapp': phone→directory lookup
 * - 'email'/'web': email→directory lookup (if email known)
 * - 'instagram'/'voice': no auto-link (requires self-link via email verification)
 */
export async function tryAutoLinkByChannel(
  userId: string,
  channelType: string,
  identifier: string,
): Promise<{ email: string; name: string } | null> {
  // Check if already linked
  const existing = await getWorkspaceIdentity(userId);
  if (existing) return existing;

  switch (channelType) {
    case 'whatsapp':
      return tryAutoLink(userId, identifier);

    case 'email':
    case 'web': {
      // identifier is the user's email
      if (!identifier.includes('@')) return null;
      const wsUser = await findWorkspaceUserByEmail(identifier);
      if (!wsUser) return null;
      await linkWorkspaceIdentity(userId, wsUser);
      return { email: wsUser.email, name: wsUser.name };
    }

    case 'instagram':
    case 'voice':
    default:
      // No auto-link for these channels — user must self-link via email verification
      return null;
  }
}
