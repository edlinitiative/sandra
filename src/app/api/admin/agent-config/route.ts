/**
 * GET  /api/admin/agent-config — Read the current tenant's agentConfig.
 * PATCH /api/admin/agent-config — Partially update the tenant's agentConfig fields.
 *
 * Requires: Next-Auth session with admin role.
 * Resolves the tenant from the session user.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { resolveTenantForUser } from '@/lib/google/context';
import { createLogger } from '@/lib/utils';
import type { TenantAgentConfig } from '@/lib/agents/tenant-config';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const log = createLogger('api:admin:agent-config');

// ── Validation schema ─────────────────────────────────────────────────────────

const patchSchema = z.object({
  agentName: z.string().min(1).max(60).optional(),
  orgName: z.string().min(1).max(120).optional(),
  orgDescription: z.string().max(2000).optional().nullable(),
  websiteUrl: z.string().url().max(200).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().nullable(),
  systemPromptOverride: z.string().max(10_000).optional().nullable(),
  additionalContext: z.string().max(10_000).optional().nullable(),
  supportedLanguages: z.array(z.string().min(1).max(10)).optional().nullable(),
  enabledTools: z.array(z.string().min(1).max(80)).optional().nullable(),
  allowedTopics: z.array(z.string().min(1).max(200)).optional().nullable(),
  offTopicResponse: z.string().max(500).optional().nullable(),
  // Platform & Deployment
  platformName: z.string().min(1).max(60).optional().nullable(),
  allowedOrigins: z.string().max(2000).optional().nullable(),
  allowedOriginSuffix: z.string().max(200).optional().nullable(),
  emailSenderAddress: z.string().email().max(200).optional().nullable(),
  // Channel Credentials
  whatsappPhoneNumberId: z.string().max(200).optional().nullable(),
  whatsappAccessToken: z.string().max(500).optional().nullable(),
  whatsappWebhookSecret: z.string().max(500).optional().nullable(),
  instagramPageAccessToken: z.string().max(500).optional().nullable(),
  instagramAppSecret: z.string().max(500).optional().nullable(),
  instagramVerifyToken: z.string().max(500).optional().nullable(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 }) };
  }
  const tenantId = await resolveTenantForUser(session.user.id);
  if (!tenantId) {
    return { error: NextResponse.json({ error: 'No tenant found for this account' }, { status: 404 }) };
  }
  return { tenantId, userId: session.user.id };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const tenant = await db.tenant.findUnique({
      where: { id: result.tenantId },
      select: { id: true, name: true, slug: true, domain: true, agentConfig: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      tenantDomain: tenant.domain,
      agentConfig: (tenant.agentConfig as TenantAgentConfig) ?? {},
    });
  } catch (err) {
    log.error('Failed to read agent config', { error: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const body = await request.json() as unknown;
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Merge with existing config — don't overwrite fields not included in the patch
    const existing = await db.tenant.findUnique({
      where: { id: result.tenantId },
      select: { agentConfig: true },
    });

    const currentConfig = (existing?.agentConfig as TenantAgentConfig) ?? {};

    // Build the merged config. Explicit `null` in the patch means "clear this field".
    const merged: TenantAgentConfig = { ...currentConfig };
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === null) {
        delete (merged as Record<string, unknown>)[key];
      } else if (value !== undefined) {
        (merged as Record<string, unknown>)[key] = value;
      }
    }

    const updated = await db.tenant.update({
      where: { id: result.tenantId },
      data: { agentConfig: merged as unknown as Prisma.InputJsonValue },
      select: { id: true, agentConfig: true },
    });

    log.info('Agent config updated', { tenantId: result.tenantId, userId: result.userId, fields: Object.keys(parsed.data) });

    return NextResponse.json({
      tenantId: updated.id,
      agentConfig: updated.agentConfig as TenantAgentConfig,
    });
  } catch (err) {
    log.error('Failed to update agent config', { error: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
