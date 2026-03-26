/**
 * Program application data access layer.
 */
import type { PrismaClient, ProgramApplication, Prisma } from '@prisma/client';

export type CreateApplicationInput = {
  userId: string;
  programName: string;
  programId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

export async function createApplication(
  prisma: PrismaClient,
  input: CreateApplicationInput,
): Promise<ProgramApplication> {
  return prisma.programApplication.create({
    data: {
      userId: input.userId,
      programName: input.programName,
      programId: input.programId,
      status: input.status ?? 'submitted',
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getApplicationsByUserId(
  prisma: PrismaClient,
  userId: string,
  options?: { status?: string; programName?: string },
): Promise<ProgramApplication[]> {
  return prisma.programApplication.findMany({
    where: {
      userId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.programName ? { programName: options.programName } : {}),
    },
    orderBy: { appliedAt: 'desc' },
  });
}

export async function getApplicationById(
  prisma: PrismaClient,
  id: string,
): Promise<ProgramApplication | null> {
  return prisma.programApplication.findUnique({ where: { id } });
}

export async function updateApplicationStatus(
  prisma: PrismaClient,
  id: string,
  status: string,
  reviewedAt?: Date,
): Promise<ProgramApplication> {
  return prisma.programApplication.update({
    where: { id },
    data: {
      status,
      ...(reviewedAt ? { reviewedAt } : {}),
    },
  });
}
