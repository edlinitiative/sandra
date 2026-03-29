import type { PrismaClient, Session, Message, Prisma } from '@prisma/client';

export type CreateSessionInput = {
  id?: string;
  userId?: string;
  channel?: string;
  language?: string;
  title?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateSessionInput = {
  title?: string;
  language?: string;
  isActive?: boolean;
  userId?: string;
  metadata?: Record<string, unknown>;
};

export async function createSession(
  prisma: PrismaClient,
  input: CreateSessionInput,
): Promise<Session> {
  return prisma.session.create({
    data: {
      id: input.id,
      userId: input.userId,
      channel: input.channel ?? 'web',
      language: input.language ?? 'en',
      title: input.title,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getSessionById(
  prisma: PrismaClient,
  id: string,
): Promise<Session | null> {
  return prisma.session.findUnique({ where: { id } });
}

export async function getSessionMessages(
  prisma: PrismaClient,
  sessionId: string,
  options: { limit?: number; orderBy?: 'asc' | 'desc' } = {},
): Promise<Message[]> {
  const { limit, orderBy = 'asc' } = options;
  return prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: orderBy },
    ...(limit ? { take: limit } : {}),
  });
}

export async function updateSession(
  prisma: PrismaClient,
  id: string,
  input: UpdateSessionInput,
): Promise<Session> {
  return prisma.session.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
    },
  });
}
