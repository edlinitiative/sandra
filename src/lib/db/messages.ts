import type { PrismaClient, Message, MessageRole, Prisma } from '@prisma/client';

export type CreateMessageInput = {
  sessionId: string;
  role: MessageRole;
  content: string;
  language?: string;
  toolName?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown>;
};

export async function createMessage(
  prisma: PrismaClient,
  input: CreateMessageInput,
): Promise<Message> {
  return prisma.message.create({
    data: {
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      language: input.language,
      toolName: input.toolName,
      toolCallId: input.toolCallId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getMessagesBySessionId(
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
