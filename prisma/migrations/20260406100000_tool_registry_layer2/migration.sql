-- Tool Registry Layer 2: Tenant-scoped tools + External API Connections

-- 1. Add tenant scoping to DynamicTool
ALTER TABLE "DynamicTool" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "DynamicTool" ADD COLUMN "apiConnectionId" TEXT;
CREATE INDEX "DynamicTool_tenantId_enabled_idx" ON "DynamicTool"("tenantId", "enabled");

-- 2. Create ExternalApiConnection table
CREATE TABLE "ExternalApiConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "openApiSpec" JSONB,
    "authType" TEXT NOT NULL DEFAULT 'api_key',
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "authConfig" JSONB,
    "defaultHeaders" JSONB,
    "rateLimitRpm" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastHealthCheck" TIMESTAMP(3),
    "lastHealthStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalApiConnection_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes
CREATE INDEX "ExternalApiConnection_tenantId_isActive_idx" ON "ExternalApiConnection"("tenantId", "isActive");
CREATE UNIQUE INDEX "ExternalApiConnection_tenantId_name_key" ON "ExternalApiConnection"("tenantId", "name");

-- 4. Foreign keys
ALTER TABLE "DynamicTool" ADD CONSTRAINT "DynamicTool_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DynamicTool" ADD CONSTRAINT "DynamicTool_apiConnectionId_fkey"
    FOREIGN KEY ("apiConnectionId") REFERENCES "ExternalApiConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExternalApiConnection" ADD CONSTRAINT "ExternalApiConnection_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
