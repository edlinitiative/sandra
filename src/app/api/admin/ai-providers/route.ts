/**
 * GET   /api/admin/ai-providers — Read AI provider configuration (keys are masked).
 * PATCH /api/admin/ai-providers — Update AI provider keys and/or priority.
 *
 * Requires: Next-Auth session with admin role.
 * Resolves the tenant from the session user.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { resolveTenantForUser } from '@/lib/google/context';
import { createLogger } from '@/lib/utils';
import {
  resolveAIConfig,
  saveAIProviderKey,
  saveAIProviderPriority,
  maskApiKey,
  invalidateAIConfigCache,
  resetAIProvider,
} from '@/lib/ai';
import type { AIProviderCredentials, AIProviderProviderConfig } from '@/lib/ai/config-resolver';
import { z } from 'zod';

import type { ProviderType } from '@prisma/client';

const log = createLogger('api:admin:ai-providers');

const AI_PROVIDER_TYPES: ProviderType[] = ['ai_openai', 'ai_gemini', 'ai_anthropic'];

// ── Validation ────────────────────────────────────────────────────────────────

const patchSchema = z.object({
  /** Individual provider updates. Send apiKey: '' or null to remove. */
  providers: z
    .object({
      openai: z
        .object({
          apiKey: z.string().optional(),
          model: z.string().max(100).optional(),
        })
        .optional(),
      gemini: z
        .object({
          apiKey: z.string().optional(),
          model: z.string().max(100).optional(),
        })
        .optional(),
      anthropic: z
        .object({
          apiKey: z.string().optional(),
          model: z.string().max(100).optional(),
        })
        .optional(),
    })
    .optional(),
  /** Provider priority order (comma-separated). */
  priority: z.string().max(200).optional(),
});

// ── Auth helper ───────────────────────────────────────────────────────────────

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

    // Force a fresh resolve (bypass cache)
    invalidateAIConfigCache();
    const config = await resolveAIConfig(result.tenantId);

    // Load raw DB rows to get health status + check which have DB keys vs env
    const dbRows = await db.connectedProvider.findMany({
      where: {
        tenantId: result.tenantId,
        provider: { in: AI_PROVIDER_TYPES },
      },
      select: {
        provider: true,
        isActive: true,
        credentials: true,
        config: true,
        lastHealthCheck: true,
        lastHealthStatus: true,
      },
    });

    const dbProviderMap = new Map(dbRows.map((r) => [r.provider, r]));

    // Build response with masked keys
    const providers = (['openai', 'gemini', 'anthropic'] as const).map((name) => {
      const dbType = { openai: 'ai_openai', gemini: 'ai_gemini', anthropic: 'ai_anthropic' }[name] as ProviderType;
      const dbRow = dbProviderMap.get(dbType);
      const keyConfig = config[name];

      // Determine source
      const dbCreds = dbRow?.credentials as unknown as AIProviderCredentials | undefined;
      const dbConfig = (dbRow?.config ?? {}) as unknown as AIProviderProviderConfig;
      const hasDbKey = dbRow?.isActive && dbCreds?.apiKey && dbCreds.apiKey.length >= 10;

      return {
        name,
        configured: !!keyConfig?.apiKey,
        source: hasDbKey ? 'database' : keyConfig?.apiKey ? 'environment' : 'none',
        maskedKey: keyConfig?.apiKey ? maskApiKey(keyConfig.apiKey) : null,
        model: hasDbKey ? dbConfig.model : keyConfig?.model,
        isActive: hasDbKey ? dbRow.isActive : !!keyConfig?.apiKey,
        lastHealthCheck: dbRow?.lastHealthCheck ?? null,
        lastHealthStatus: dbRow?.lastHealthStatus ?? null,
      };
    });

    return NextResponse.json({
      providers,
      priority: config.priority,
    });
  } catch (err) {
    log.error('Failed to read AI providers', { error: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const body = (await request.json()) as unknown;
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { providers, priority } = parsed.data;

    // ── Save provider keys ──
    if (providers) {
      for (const name of ['openai', 'gemini', 'anthropic'] as const) {
        const update = providers[name];
        if (!update) continue;

        // Skip if apiKey field wasn't sent (undefined = no change)
        if (update.apiKey === undefined) continue;

        const apiKey = update.apiKey === '' ? null : update.apiKey;
        await saveAIProviderKey(result.tenantId, name, apiKey, update.model);
      }
    }

    // ── Save priority ──
    if (priority !== undefined) {
      await saveAIProviderPriority(result.tenantId, priority);
    }

    // Reset the cached provider singleton so next request picks up new keys
    resetAIProvider();

    log.info('AI provider config updated', {
      tenantId: result.tenantId,
      userId: result.userId,
      providers: providers ? Object.keys(providers) : [],
      priorityChanged: priority !== undefined,
    });

    // Return the new state
    invalidateAIConfigCache();
    const newConfig = await resolveAIConfig(result.tenantId);

    const summary = (['openai', 'gemini', 'anthropic'] as const).map((name) => ({
      name,
      configured: !!newConfig[name]?.apiKey,
      maskedKey: newConfig[name]?.apiKey ? maskApiKey(newConfig[name]!.apiKey) : null,
    }));

    return NextResponse.json({
      providers: summary,
      priority: newConfig.priority,
      message: 'AI provider configuration saved. Changes take effect on the next conversation.',
    });
  } catch (err) {
    log.error('Failed to update AI providers', { error: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
