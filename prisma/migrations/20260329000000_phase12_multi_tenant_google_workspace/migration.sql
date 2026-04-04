-- Phase 12: Multi-Tenant & Google Workspace Integration
-- Adds Tenant, TenantMember, ConnectedProvider models for
-- platform-agnostic, multi-tenant external service integration.

-- Enums
CREATE TYPE "TenantRole" AS ENUM ('basic', 'manager', 'admin');
CREATE TYPE "ProviderType" AS ENUM ('google_workspace', 'microsoft_365', 'custom_api');

-- Tenants
CREATE TABLE "Tenant" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "slug"      TEXT         NOT NULL,
    "domain"    TEXT,
    "isActive"  BOOLEAN      NOT NULL DEFAULT true,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key"    ON "Tenant"("slug");
CREATE UNIQUE INDEX "Tenant_domain_key"  ON "Tenant"("domain");
CREATE INDEX "Tenant_slug_idx"           ON "Tenant"("slug");
CREATE INDEX "Tenant_domain_idx"         ON "Tenant"("domain");

-- Tenant Members (user ↔ tenant with role)
CREATE TABLE "TenantMember" (
    "id"        TEXT          NOT NULL,
    "tenantId"  TEXT          NOT NULL,
    "userId"    TEXT          NOT NULL,
    "role"      "TenantRole"  NOT NULL DEFAULT 'basic',
    "isActive"  BOOLEAN       NOT NULL DEFAULT true,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "TenantMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantMember_tenantId_userId_key" ON "TenantMember"("tenantId", "userId");
CREATE INDEX "TenantMember_userId_idx"                 ON "TenantMember"("userId");
CREATE INDEX "TenantMember_tenantId_role_idx"          ON "TenantMember"("tenantId", "role");

ALTER TABLE "TenantMember"
  ADD CONSTRAINT "TenantMember_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantMember"
  ADD CONSTRAINT "TenantMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Connected Providers (tenant ↔ external service credentials)
CREATE TABLE "ConnectedProvider" (
    "id"               TEXT           NOT NULL,
    "tenantId"         TEXT           NOT NULL,
    "provider"         "ProviderType" NOT NULL,
    "label"            TEXT,
    "credentials"      JSONB          NOT NULL,
    "config"           JSONB,
    "isActive"         BOOLEAN        NOT NULL DEFAULT true,
    "lastHealthCheck"  TIMESTAMP(3),
    "lastHealthStatus" TEXT,
    "createdAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "ConnectedProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConnectedProvider_tenantId_provider_key" ON "ConnectedProvider"("tenantId", "provider");
CREATE INDEX "ConnectedProvider_tenantId_idx"                 ON "ConnectedProvider"("tenantId");
CREATE INDEX "ConnectedProvider_provider_idx"                 ON "ConnectedProvider"("provider");

ALTER TABLE "ConnectedProvider"
  ADD CONSTRAINT "ConnectedProvider_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
