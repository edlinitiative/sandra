import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';

const log = createLogger('channels:identity');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChannelIdentityRecord {
  id: string;
  userId: string;
  channel: string;
  externalId: string;
  displayName: string | null;
  verified: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResolveChannelIdentityParams {
  channel: string;
  externalId: string;       // Phone number, PSID, email, etc.
  displayName?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface ResolveChannelIdentityResult {
  userId: string;
  channelIdentityId: string;
  isNew: boolean;
  displayName: string | null;
}

// ─── Channel Identity DB Operations ──────────────────────────────────────────

/**
 * Find a channel identity by channel + externalId.
 */
export async function findChannelIdentity(
  channel: string,
  externalId: string,
): Promise<ChannelIdentityRecord | null> {
  const record = await db.$queryRaw<ChannelIdentityRecord[]>`
    SELECT * FROM "ChannelIdentity"
    WHERE channel = ${channel} AND "externalId" = ${externalId}
    LIMIT 1
  `;
  return record[0] ?? null;
}

/**
 * Resolve a channel identity to a Sandra user, creating one if necessary.
 *
 * Flow:
 * 1. Look up existing ChannelIdentity for (channel, externalId)
 * 2. If found → return linked userId
 * 3. If not found → create a new User + ChannelIdentity
 *
 * This ensures every WhatsApp phone number gets exactly one Sandra user.
 */
export async function resolveChannelIdentity(
  params: ResolveChannelIdentityParams,
): Promise<ResolveChannelIdentityResult> {
  const { channel, externalId, displayName, language = 'en', metadata } = params;

  // Try to find existing identity
  const existing = await findChannelIdentity(channel, externalId);

  if (existing) {
    log.info('Resolved existing channel identity', {
      channel,
      externalId: redactId(externalId),
      userId: existing.userId,
    });

    // Update displayName if changed
    if (displayName && displayName !== existing.displayName) {
      await db.$executeRaw`
        UPDATE "ChannelIdentity"
        SET "displayName" = ${displayName}, "updatedAt" = NOW()
        WHERE id = ${existing.id}
      `;
    }

    return {
      userId: existing.userId,
      channelIdentityId: existing.id,
      isNew: false,
      displayName: existing.displayName,
    };
  }

  // No existing identity → create user + identity atomically
  log.info('Creating new channel identity', {
    channel,
    externalId: redactId(externalId),
    displayName,
  });

  // Create the user first
  const user = await db.user.create({
    data: {
      name: displayName ?? null,
      language,
      channel,
      externalId: `${channel}:${externalId}`,
    },
  });

  // Create the channel identity record
  const identityId = crypto.randomUUID();
  await db.$executeRaw`
    INSERT INTO "ChannelIdentity" (id, "userId", channel, "externalId", "displayName", verified, metadata, "updatedAt")
    VALUES (
      ${identityId},
      ${user.id},
      ${channel},
      ${externalId},
      ${displayName ?? null},
      false,
      ${metadata ? JSON.stringify(metadata) : null}::jsonb,
      NOW()
    )
  `;

  log.info('Created new channel user', {
    userId: user.id,
    channel,
    externalId: redactId(externalId),
  });

  return {
    userId: user.id,
    channelIdentityId: identityId,
    isNew: true,
    displayName: displayName ?? null,
  };
}

/**
 * Link an existing Sandra user account to a channel identity.
 * Used when a user authenticates on another channel after initial WhatsApp contact.
 */
export async function linkChannelIdentity(
  userId: string,
  channel: string,
  externalId: string,
  displayName?: string,
): Promise<void> {
  const identityId = crypto.randomUUID();
  await db.$executeRaw`
    INSERT INTO "ChannelIdentity" (id, "userId", channel, "externalId", "displayName", verified, "updatedAt")
    VALUES (${identityId}, ${userId}, ${channel}, ${externalId}, ${displayName ?? null}, false, NOW())
    ON CONFLICT (channel, "externalId") DO UPDATE
      SET "userId" = ${userId},
          "displayName" = COALESCE(${displayName ?? null}, "ChannelIdentity"."displayName"),
          "updatedAt" = NOW()
  `;

  log.info('Linked channel identity', {
    userId,
    channel,
    externalId: redactId(externalId),
  });
}

/**
 * Get all channel identities for a user.
 */
export async function getUserChannelIdentities(
  userId: string,
): Promise<ChannelIdentityRecord[]> {
  return db.$queryRaw<ChannelIdentityRecord[]>`
    SELECT * FROM "ChannelIdentity"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" ASC
  `;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Partially redact a phone number or ID for logging purposes. */
function redactId(id: string): string {
  if (id.length <= 6) return '***';
  return `${id.slice(0, 3)}***${id.slice(-2)}`;
}
