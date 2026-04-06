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
  return prisma.user.upsert({
    where: { externalId: input.externalId },
    create: {
      externalId: input.externalId,
      name: input.name ?? undefined,
      email: input.email ?? undefined,
      language: input.language ?? 'en',
      channel: input.channel ?? DEFAULT_CHANNEL,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
    update: {
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
