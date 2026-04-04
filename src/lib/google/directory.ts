/**
 * Google Directory — access Workspace user directory (contacts).
 *
 * Uses the Admin SDK Directory API with service account impersonation.
 * The impersonated user must be a Workspace admin for directory access.
 *
 * Also exposes listDirectoryPeopleWithBirthdays() which uses the Google People
 * API to fetch birthday data stored against Workspace directory contacts.
 */

import { createLogger } from '@/lib/utils';
import { getContextToken, GOOGLE_SCOPES } from './auth';
import type {
  GoogleWorkspaceContext,
  DirectoryUser,
  DirectorySearchOptions,
  DirectorySearchResult,
} from './types';

const log = createLogger('google:directory');

const DIRECTORY_API = 'https://admin.googleapis.com/admin/directory/v1';
const DIRECTORY_SCOPES = [GOOGLE_SCOPES.DIRECTORY_READONLY];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDirectoryUser(item: Record<string, unknown>): DirectoryUser {
  const name = item.name as Record<string, string> | undefined;
  const phones = item.phones as Array<{ value: string; type?: string }> | undefined;
  const recoveryPhone = item.recoveryPhone as string | undefined;

  // Prefer a work/mobile phone, fall back to recovery phone
  const phone = phones?.[0]?.value ?? recoveryPhone ?? undefined;

  return {
    id: item.id as string,
    email: (item.primaryEmail as string) ?? '',
    name: name ? `${name.givenName ?? ''} ${name.familyName ?? ''}`.trim() : '',
    givenName: name?.givenName,
    familyName: name?.familyName,
    department: (item.orgUnitPath as string) ?? undefined,
    title: undefined, // Available in organizations array if configured
    phone,
    photoUrl: (item.thumbnailPhotoUrl as string) ?? undefined,
    isAdmin: (item.isAdmin as boolean) ?? false,
    suspended: (item.suspended as boolean) ?? false,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List users in the Workspace domain.
 */
export async function listUsers(
  ctx: GoogleWorkspaceContext,
  options: DirectorySearchOptions = {},
): Promise<DirectorySearchResult> {
  log.info('Listing directory users', { domain: ctx.config.domain, tenantId: ctx.tenantId });

  // Must impersonate a Super Admin for directory access
  const adminCtx: GoogleWorkspaceContext = {
    ...ctx,
    impersonateEmail: ctx.config.directoryAdminEmail ?? ctx.config.adminEmail,
  };

  const token = await getContextToken(adminCtx, DIRECTORY_SCOPES);
  const params: Record<string, string> = {
    domain: ctx.config.domain,
    maxResults: String(options.maxResults ?? 50),
    orderBy: 'email',
    projection: 'full',
  };

  if (options.query) {
    params.query = options.query;
  }
  if (options.pageToken) {
    params.pageToken = options.pageToken;
  }

  const url = new URL(`${DIRECTORY_API}/users`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    log.error('Directory list failed', { status: res.status, body });
    throw new Error(`Directory API failed: ${res.status} — ${body}`);
  }

  const data = (await res.json()) as {
    users?: Record<string, unknown>[];
    nextPageToken?: string;
  };

  return {
    users: (data.users ?? []).map(toDirectoryUser),
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Find a user by their email address.
 */
export async function getUserByEmail(
  ctx: GoogleWorkspaceContext,
  email: string,
): Promise<DirectoryUser | null> {
  log.info('Looking up user by email', { email, tenantId: ctx.tenantId });

  const adminCtx: GoogleWorkspaceContext = {
    ...ctx,
    impersonateEmail: ctx.config.directoryAdminEmail ?? ctx.config.adminEmail,
  };

  const token = await getContextToken(adminCtx, DIRECTORY_SCOPES);
  const url = `${DIRECTORY_API}/users/${encodeURIComponent(email)}?projection=full`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directory user lookup failed: ${res.status} — ${body}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  return toDirectoryUser(data);
}
// ─── People API — birthday contacts ──────────────────────────────────────────

const PEOPLE_API = 'https://people.googleapis.com/v1';

export interface PersonWithBirthday {
  resourceName: string;
  name: string;
  /** MM-DD normalised, e.g. "04-03" */
  birthday: string;
  email: string;
  phone: string;
}

/**
 * List all Workspace directory people who have a birthday set, using the
 * Google People API (`people:listDirectoryPeople`).
 *
 * Domain-wide delegation: impersonates the configured admin email.
 * Required scope: contacts.readonly
 *
 * Returns people whose birthday month+day matches `filterMMDD` (if provided),
 * or ALL people with a birthday set (if omitted).
 */
export async function listDirectoryPeopleWithBirthdays(
  ctx: GoogleWorkspaceContext,
  filterMMDD?: string,
): Promise<PersonWithBirthday[]> {
  log.info('Listing directory people with birthdays via People API', {
    tenantId: ctx.tenantId,
    filter: filterMMDD ?? 'all',
  });

  const adminCtx: GoogleWorkspaceContext = {
    ...ctx,
    impersonateEmail: ctx.config.directoryAdminEmail ?? ctx.config.adminEmail,
  };

  const token = await getContextToken(adminCtx, [GOOGLE_SCOPES.CONTACTS_READONLY]);

  const results: PersonWithBirthday[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      readMask: 'names,emailAddresses,birthdays,phoneNumbers',
      sources: 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${PEOPLE_API}/people:listDirectoryPeople?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      // 403/404 → domain-wide delegation may not have contacts.readonly granted; return empty
      if (res.status === 403 || res.status === 404) {
        log.warn('People API listDirectoryPeople permission denied or not found — skipping contacts source', {
          status: res.status, body,
        });
        return [];
      }
      throw new Error(`People API listDirectoryPeople failed: ${res.status} — ${body}`);
    }

    const data = (await res.json()) as {
      people?: Record<string, unknown>[];
      nextPageToken?: string;
    };

    for (const person of data.people ?? []) {
      // ── Extract birthday ──────────────────────────────────────────────────
      const birthdays = person.birthdays as Array<{ date?: { month?: number; day?: number } }> | undefined;
      if (!birthdays?.length) continue;
      const bd = birthdays[0]?.date;
      if (!bd?.month || !bd.day) continue;

      const mmdd = `${String(bd.month).padStart(2, '0')}-${String(bd.day).padStart(2, '0')}`;
      if (filterMMDD && mmdd !== filterMMDD) continue;

      // ── Extract name ──────────────────────────────────────────────────────
      const names = person.names as Array<{ displayName?: string }> | undefined;
      const displayName = names?.[0]?.displayName ?? '';
      if (!displayName) continue;

      // ── Extract email ─────────────────────────────────────────────────────
      const emails = person.emailAddresses as Array<{ value?: string }> | undefined;
      const email = emails?.[0]?.value ?? '';

      // ── Extract phone ─────────────────────────────────────────────────────
      const phones = person.phoneNumbers as Array<{ value?: string }> | undefined;
      const phone = phones?.[0]?.value ?? '';

      results.push({
        resourceName: person.resourceName as string ?? '',
        name:  displayName,
        birthday: mmdd,
        email,
        phone,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  log.info(`People API returned ${results.length} birthday match(es)`, {
    tenantId: ctx.tenantId,
    filter: filterMMDD,
  });
  return results;
}