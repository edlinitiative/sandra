import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForUser } from '@/lib/google/context';
import { getPlatformConfig } from '@/lib/config/platform';
import { env } from '@/lib/config/env';
import { createLogger } from '@/lib/utils';

const log = createLogger('api:admin:meta-onboarding');

type MetaPage = {
  id: string;
  name: string;
  access_token?: string;
  connected_instagram_account?: { id?: string; username?: string };
  instagram_business_account?: { id?: string; username?: string };
};

interface MetaOnboardingSummary {
  callbackUrl: string;
  checks: {
    accessToken: boolean;
    verifyToken: boolean;
    appSecret: boolean;
    pagesFound: boolean;
    instagramLinkedPage: boolean;
  };
  actor: { id: string; name: string } | null;
  pages: Array<{
    id: string;
    name: string;
    hasPageToken: boolean;
    subscribed: boolean;
    instagramAccountId: string | null;
    instagramUsername: string | null;
  }>;
  recommendedPageId: string | null;
  notes: string[];
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  if (session.user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 }) } as const;
  }
  const tenantId = await resolveTenantForUser(session.user.id);
  if (!tenantId) {
    return { error: NextResponse.json({ error: 'No tenant found for this account' }, { status: 404 }) } as const;
  }
  return { tenantId } as const;
}

async function graphGet<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`https://graph.facebook.com/v19.0${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { method: 'GET' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json as T;
}

async function graphPostForm<T>(path: string, accessToken: string, form: Record<string, string>): Promise<T> {
  const body = new URLSearchParams({ ...form, access_token: accessToken });
  const res = await fetch(`https://graph.facebook.com/v19.0${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json as T;
}

async function listMetaPages(accessToken: string): Promise<MetaPage[]> {
  const pagesRes = await graphGet<{ data?: MetaPage[] }>('/me/accounts', accessToken, {
    fields: 'id,name,access_token,connected_instagram_account{id,username},instagram_business_account{id,username}',
    limit: '50',
  });
  return pagesRes.data ?? [];
}

async function buildSummary(tenantId: string, callbackUrl: string): Promise<MetaOnboardingSummary> {
  const cfg = await getPlatformConfig(tenantId);
  const accessToken = cfg.instagram.pageAccessToken.trim();
  const verifyToken = String(
    cfg.instagram.verifyToken
    || env.FACEBOOK_VERIFY_TOKEN
    || env.META_VERIFY_TOKEN
    || '',
  ).trim();
  const appSecret = (cfg.instagram.appSecret || cfg.whatsapp.appSecret).trim();

  const notes: string[] = [];

  if (!accessToken) {
    notes.push('Missing Meta page/system-user access token. Save it under Platform Settings → Instagram.');
  }
  if (!verifyToken) {
    notes.push('Missing webhook verify token. Set Instagram Verify Token (or FACEBOOK_VERIFY_TOKEN / META_VERIFY_TOKEN).');
  }
  if (!appSecret) {
    notes.push('Missing app secret. Signature verification is strongly recommended in production.');
  }

  if (!accessToken) {
    return {
      callbackUrl,
      checks: {
        accessToken: false,
        verifyToken: Boolean(verifyToken),
        appSecret: Boolean(appSecret),
        pagesFound: false,
        instagramLinkedPage: false,
      },
      actor: null,
      pages: [],
      recommendedPageId: null,
      notes,
    };
  }

  let actor: { id: string; name: string } | null = null;
  let pages: MetaPage[] = [];
  try {
    const me = await graphGet<{ id: string; name: string }>('/me', accessToken, { fields: 'id,name' });
    actor = { id: me.id, name: me.name };

    pages = await listMetaPages(accessToken);
  } catch (err) {
    notes.push(`Meta token validation failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    return {
      callbackUrl,
      checks: {
        accessToken: false,
        verifyToken: Boolean(verifyToken),
        appSecret: Boolean(appSecret),
        pagesFound: false,
        instagramLinkedPage: false,
      },
      actor,
      pages: [],
      recommendedPageId: null,
      notes,
    };
  }

  const pageSummaries = await Promise.all(pages.map(async (page) => {
    let subscribed = false;
    try {
      const sub = await graphGet<{ data?: Array<{ id: string; name?: string }> }>(`/${page.id}/subscribed_apps`, page.access_token || accessToken);
      subscribed = (sub.data?.length ?? 0) > 0;
    } catch {
      // best-effort
    }

    const ig = page.connected_instagram_account ?? page.instagram_business_account;

    return {
      id: page.id,
      name: page.name,
      hasPageToken: Boolean(page.access_token),
      subscribed,
      instagramAccountId: ig?.id ?? null,
      instagramUsername: ig?.username ?? null,
    };
  }));

  const recommended = pageSummaries.find((p) => p.instagramAccountId)?.id
    ?? pageSummaries[0]?.id
    ?? null;

  if (pageSummaries.length === 0) {
    notes.push('No Facebook Pages were returned by /me/accounts. Check token permissions and business access.');
  }
  if (!pageSummaries.some((p) => p.instagramAccountId)) {
    notes.push('No linked Instagram Business/Creator account found on accessible pages.');
  }

  return {
    callbackUrl,
    checks: {
      accessToken: true,
      verifyToken: Boolean(verifyToken),
      appSecret: Boolean(appSecret),
      pagesFound: pageSummaries.length > 0,
      instagramLinkedPage: pageSummaries.some((p) => p.instagramAccountId),
    },
    actor,
    pages: pageSummaries,
    recommendedPageId: recommended,
    notes,
  };
}

export async function GET(request: Request) {
  try {
    const guard = await requireAdmin();
    if ('error' in guard) return guard.error;

    const origin = env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const callbackUrl = `${origin.replace(/\/$/, '')}/api/webhooks/instagram`;
    const summary = await buildSummary(guard.tenantId, callbackUrl);

    return NextResponse.json({ ok: true, action: 'validate', ...summary });
  } catch (err) {
    log.error('Meta onboarding validation failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireAdmin();
    if ('error' in guard) return guard.error;

    const origin = env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const callbackUrl = `${origin.replace(/\/$/, '')}/api/webhooks/instagram`;
    const summary = await buildSummary(guard.tenantId, callbackUrl);

    const body = await request.json().catch(() => ({})) as { pageId?: string };
    const pageId = body.pageId || summary.recommendedPageId;

    if (!pageId) {
      return NextResponse.json({
        ok: false,
        error: 'No page available to subscribe',
        ...summary,
      }, { status: 400 });
    }

    const page = summary.pages.find((p) => p.id === pageId);
    if (!page) {
      return NextResponse.json({ ok: false, error: 'Invalid pageId' }, { status: 400 });
    }

    const cfg = await getPlatformConfig(guard.tenantId);
    const accessToken = cfg.instagram.pageAccessToken.trim();
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'Missing access token' }, { status: 400 });
    }

    const pages = await listMetaPages(accessToken);
    const selectedPage = pages.find((p) => p.id === pageId);
    const pageToken = selectedPage?.access_token || accessToken;

    await graphPostForm<{ success: boolean }>(`/${pageId}/subscribed_apps`, pageToken, {
      subscribed_fields: 'messages,messaging_postbacks',
    });

    const refreshed = await buildSummary(guard.tenantId, callbackUrl);

    return NextResponse.json({
      ok: true,
      action: 'subscribe',
      subscribedPageId: pageId,
      ...refreshed,
    });
  } catch (err) {
    log.error('Meta onboarding subscribe failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : 'Subscription failed',
    }, { status: 500 });
  }
}
