-- DropIndex
DROP INDEX "IndexedDocument_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "ActionRequest" ALTER COLUMN "requestedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reviewedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChannelIdentity" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "DynamicTool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "handlerCode" TEXT NOT NULL,
    "requiredScopes" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tested" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "sourceGapIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DynamicTool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DynamicTool_name_key" ON "DynamicTool"("name");

-- CreateIndex
CREATE INDEX "DynamicTool_enabled_idx" ON "DynamicTool"("enabled");

-- CreateIndex
CREATE INDEX "DynamicTool_createdAt_idx" ON "DynamicTool"("createdAt");
