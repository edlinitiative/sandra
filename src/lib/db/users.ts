import type { PrismaClient, Prisma, User } from '@prisma/client';
import { DEFAULT_CHANNEL } from '@/lib/channels/types';

export type ResolveUserInput = {
  externalId: string;
  name?: string | null;
  email?: string | null;
  language?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
};

export async function getUserById(
  prisma: PrismaClient,
  id: string,
): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByExternalId(
  prisma: PrismaClient,
  externalId: string,
): Promise<User | null> {
  return prisma.user.findUnique({ where: { externalId } });
}

export async function resolveUserByExternalId(
  prisma: PrismaClient,
  input: ResolveUserInput,
): Promise<User> {
  // 1. Try exact match on externalId
  const byExternal = await prisma.user.findUnique({ where: { externalId: input.externalId } });
  if (byExternal) {
    // Update mutable fields
    return prisma.user.update({
      where: { id: byExternal.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.channel !== undefined ? { channel: input.channel } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  // 2. If no externalId match, try to find an existing user by email and link them.
  //    This handles the case where a user was seeded/created before they ever
  //    logged in via OAuth (e.g. admin users), so their externalId is null.
  if (input.email) {
    const byEmail = await prisma.user.findFirst({
      where: { email: input.email, externalId: null },
    });
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: {
          externalId: input.externalId,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.language !== undefined ? { language: input.language } : {}),
          ...(input.channel !== undefined ? { channel: input.channel } : {}),
        },
      });
    }
  }

  // 3. No match at all — create a new user
  return prisma.user.create({
    data: {
      externalId: input.externalId,
      name: input.name ?? undefined,
      email: input.email ?? undefined,
      language: input.language ?? 'en',
      channel: input.channel ?? DEFAULT_CHANNEL,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
