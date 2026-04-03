/**
 * Google Directory — access Workspace user directory (contacts).
 *
 * Uses the Admin SDK Directory API with service account impersonation.
 * The impersonated user must be a Workspace admin for directory access.
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
