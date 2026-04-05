/**
 * POST /api/tenant/keys — Generate a new tenant API key.
 * GET  /api/tenant/keys — List all keys for the caller's tenant.
 *
 * Requires: Next-Auth session with admin role OR an existing tenant API key
 * with admin scope.
 *
 * The plaintext key is returned ONLY from POST and never stored.
 * keyHash (SHA-256) and keyPrefix (first 12 chars) are persisted.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { resolveTenantForUser } from '@/lib/google/context';
import { createLogger } from '@/lib/utils';
import { z } from 'zod';

const log = createLogger('api:tenant-keys');

const createKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.string()).optional().default(['chat:send', 'knowledge:read']),
  expiresAt: z.string().datetime().optional(),
});

// ─── GET /api/tenant/keys ─────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = await resolveTenantForUser(session.user.id);
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found for this account' }, { status: 404 });
    }

    const keys = await (db as unknown as TenantApiKeyDb).tenantApiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ keys });
  } catch (err) {
    log.error('Failed to list tenant API keys', { error: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/tenant/keys ────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = await resolveTenantForUser(session.user.id);
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found for this account' }, { status: 404 });
    }

    const body = await request.json() as unknown;
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, scopes, expiresAt } = parsed.data;

    // Generate a cryptographically secure key
    // Format: sk_live_<32 random hex bytes> = sk_live_ + 64 chars = 72 chars total
    const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const rawSecret = randomBytes(32).toString('hex');
    const plaintext = `sk_${env}_${rawSecret}`;
    const keyHash = createHash('sha256').update(plaintext).digest('hex');
    const keyPrefix = plaintext.slice(0, 12);

    const apiKey = await (db as unknown as TenantApiKeyDb).tenantApiKey.create({
      data: {
        tenantId,
        name,
        keyHash,
        keyPrefix,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: session.user.id,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    log.info('Tenant API key created', { keyId: apiKey.id, tenantId, name });

    // Return plaintext ONCE — never retrievable again
    return NextResponse.json({ ...apiKey, key: plaintext }, { status: 201 });
  } catch (err) {
    log.error('Failed to create tenant API key', { error: err instanceof Error ? err.message : 'unknown' });
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
  lastUsedAt: Date | null;
  createdAt: Date;
}

interface TenantApiKeyDb {
  tenantApiKey: {
    findMany: (args: unknown) => Promise<TenantApiKeyRow[]>;
    create: (args: unknown) => Promise<TenantApiKeyRow>;
  };
}
