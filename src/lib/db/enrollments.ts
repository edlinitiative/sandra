/**
 * Enrollment data access layer.
 */
import type { PrismaClient, Enrollment, Prisma } from '@prisma/client';

export type CreateEnrollmentInput = {
  userId: string;
  courseId: string;
  courseName: string;
  platform: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

export async function createEnrollment(
  prisma: PrismaClient,
  input: CreateEnrollmentInput,
): Promise<Enrollment> {
  return prisma.enrollment.create({
    data: {
      userId: input.userId,
      courseId: input.courseId,
      courseName: input.courseName,
      platform: input.platform,
      status: input.status ?? 'active',
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getEnrollmentsByUserId(
  prisma: PrismaClient,
  userId: string,
  options?: { platform?: string; status?: string },
): Promise<Enrollment[]> {
  return prisma.enrollment.findMany({
    where: {
      userId,
      ...(options?.platform ? { platform: options.platform } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: { enrolledAt: 'desc' },
  });
}

export async function getEnrollmentById(
  prisma: PrismaClient,
  id: string,
): Promise<Enrollment | null> {
  return prisma.enrollment.findUnique({ where: { id } });
}

export async function updateEnrollmentStatus(
  prisma: PrismaClient,
  id: string,
  status: string,
  completedAt?: Date,
): Promise<Enrollment> {
  return prisma.enrollment.update({
    where: { id },
    data: {
      status,
      ...(completedAt ? { completedAt } : {}),
    },
  });
}
