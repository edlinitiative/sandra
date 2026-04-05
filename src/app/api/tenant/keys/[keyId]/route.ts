/**
 * PATCH  /api/tenant/keys/[keyId] — Update a key's name/scopes.
 * DELETE /api/tenant/keys/[keyId] — Revoke (soft-delete) a key.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { resolveTenantForUser } from '@/lib/google/context';
import { createLogger } from '@/lib/utils';
import { z } from 'zod';

const log = createLogger('api:tenant-keys');

const updateKeySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  scopes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ keyId: string }>;
}

// ─── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { keyId } = await params;
    const tenantId = await resolveTenantForUser(session.user.id);
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const existing = await (db as unknown as TenantApiKeyDb).tenantApiKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const body = await request.json() as unknown;
    const parsed = updateKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await (db as unknown as TenantApiKeyDb).tenantApiKey.update({
      where: { id: keyId },
      data: parsed.data,
      select: { id: true, name: true, keyPrefix: true, scopes: true, isActive: true, expiresAt: true, createdAt: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    log.error('Failed to update API key', { error: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { keyId } = await params;
    const tenantId = await resolveTenantForUser(session.user.id);
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const existing = await (db as unknown as TenantApiKeyDb).tenantApiKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Soft-delete: set isActive = false so history is preserved
    await (db as unknown as TenantApiKeyDb).tenantApiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    log.info('Tenant API key revoked', { keyId, tenantId });
    return NextResponse.json({ revoked: true });
  } catch (err) {
    log.error('Failed to revoke API key', { error: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

interface TenantApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: Date | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
}

interface TenantApiKeyDb {
  tenantApiKey: {
    findFirst: (args: unknown) => Promise<TenantApiKeyRow | null>;
    update: (args: unknown) => Promise<TenantApiKeyRow>;
  };
}
