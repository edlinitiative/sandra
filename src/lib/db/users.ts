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
  //    Also handles guest users who chatted before logging in — promote them to
  //    at least 'student' since they just authenticated via OAuth/OTP.
  if (input.email) {
    const byEmail = await prisma.user.findFirst({
      where: { email: input.email, externalId: null },
    });
    if (byEmail) {
      const updateData: Prisma.UserUpdateInput = {
        externalId: input.externalId,
      };
      // Promote guests who just authenticated for the first time
      if (byEmail.role === 'guest') {
        updateData.role = 'student';
      }
      if (input.name !== undefined) updateData.name = input.name;
      if (input.language !== undefined) updateData.language = input.language;
      if (input.channel !== undefined) updateData.channel = input.channel;
      return prisma.user.update({
        where: { id: byEmail.id },
        data: updateData,
      });
    }
  }

  // 3. No match at all — create a new user.
  //    OAuth/OTP sign-ins use 'student' role; everything else (unauthenticated
  //    canonical user flow) falls through to the Prisma default ('guest').
  const isAuthIdentity = input.externalId.startsWith('google:') ||
    input.externalId.startsWith('facebook:') ||
    input.externalId.startsWith('email:') ||
    input.externalId.startsWith('phone:');
  const createData: Prisma.UserCreateInput = {
    externalId: input.externalId,
    name: input.name ?? undefined,
    email: input.email ?? undefined,
    language: input.language ?? 'en',
    channel: input.channel ?? DEFAULT_CHANNEL,
    metadata: input.metadata as Prisma.InputJsonValue | undefined,
  };
  if (isAuthIdentity) {
    createData.role = 'student';
  }
  return prisma.user.create({ data: createData });
}
