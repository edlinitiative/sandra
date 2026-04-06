/**
 * Certificate data access layer.
 */
import type { PrismaClient, Certificate, Prisma } from '@prisma/client';

export type CreateCertificateInput = {
  userId: string;
  tenantId?: string;
  courseName: string;
  platform: string;
  certificateUrl?: string;
  metadata?: Record<string, unknown>;
};

export async function createCertificate(
  prisma: PrismaClient,
  input: CreateCertificateInput,
): Promise<Certificate> {
  return prisma.certificate.create({
    data: {
      userId: input.userId,
      tenantId: input.tenantId,
      courseName: input.courseName,
      platform: input.platform,
      certificateUrl: input.certificateUrl,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getCertificatesByUserId(
  prisma: PrismaClient,
  userId: string,
  options?: { tenantId?: string; platform?: string },
): Promise<Certificate[]> {
  return prisma.certificate.findMany({
    where: {
      userId,
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      ...(options?.platform ? { platform: options.platform } : {}),
    },
    orderBy: { issuedAt: 'desc' },
  });
}

export async function getCertificateById(
  prisma: PrismaClient,
  id: string,
): Promise<Certificate | null> {
  return prisma.certificate.findUnique({ where: { id } });
}
