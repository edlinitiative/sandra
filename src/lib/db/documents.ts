import type { PrismaClient, IndexedDocument, Prisma } from '@prisma/client';

export type CreateIndexedDocumentInput = {
  sourceId: string;
  title?: string;
  path?: string;
  content: string;
  chunkIndex?: number;
  chunkTotal?: number;
  contentHash?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
};

export async function createIndexedDocument(
  prisma: PrismaClient,
  input: CreateIndexedDocumentInput,
): Promise<IndexedDocument> {
  return prisma.indexedDocument.create({
    data: {
      sourceId: input.sourceId,
      title: input.title,
      path: input.path,
      content: input.content,
      chunkIndex: input.chunkIndex ?? 0,
      chunkTotal: input.chunkTotal ?? 1,
      contentHash: input.contentHash,
      embedding: input.embedding ?? [],
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getDocumentsBySourceId(
  prisma: PrismaClient,
  sourceId: string,
): Promise<IndexedDocument[]> {
  return prisma.indexedDocument.findMany({
    where: { sourceId },
    orderBy: [{ path: 'asc' }, { chunkIndex: 'asc' }],
  });
}

export async function getDocumentByHash(
  prisma: PrismaClient,
  sourceId: string,
  contentHash: string,
): Promise<IndexedDocument | null> {
  return prisma.indexedDocument.findFirst({
    where: { sourceId, contentHash },
  });
}
