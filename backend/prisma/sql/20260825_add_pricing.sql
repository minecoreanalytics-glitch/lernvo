-- Additive schema for tenant-scoped pricing grids.
-- Lernvo applies schema with `npx prisma db push`. This file is the equivalent SQL
-- for a one-shot apply on an existing database:
--   psql "$DATABASE_URL" -f prisma/sql/20260825_add_pricing.sql

CREATE TABLE IF NOT EXISTS "PricingCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sheetName" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PricingItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "description" TEXT,
    "price" TEXT NOT NULL,
    "priceNumeric" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'HTG',
    "unit" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PricingUpload" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "changeCount" INTEGER NOT NULL DEFAULT 0,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingUpload_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PricingChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "oldPrice" TEXT,
    "newPrice" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PricingAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PricingCategory_tenantId_brand_name_key" ON "PricingCategory"("tenantId", "brand", "name");
CREATE INDEX IF NOT EXISTS "PricingCategory_tenantId_brand_idx" ON "PricingCategory"("tenantId", "brand");

CREATE INDEX IF NOT EXISTS "PricingItem_tenantId_idx" ON "PricingItem"("tenantId");
CREATE INDEX IF NOT EXISTS "PricingItem_categoryId_idx" ON "PricingItem"("categoryId");

CREATE INDEX IF NOT EXISTS "PricingUpload_tenantId_brand_createdAt_idx" ON "PricingUpload"("tenantId", "brand", "createdAt");
CREATE INDEX IF NOT EXISTS "PricingUpload_importBatchId_idx" ON "PricingUpload"("importBatchId");

CREATE INDEX IF NOT EXISTS "PricingChange_tenantId_idx" ON "PricingChange"("tenantId");
CREATE INDEX IF NOT EXISTS "PricingChange_uploadId_idx" ON "PricingChange"("uploadId");

CREATE UNIQUE INDEX IF NOT EXISTS "PricingAlert_uploadId_key" ON "PricingAlert"("uploadId");
CREATE INDEX IF NOT EXISTS "PricingAlert_tenantId_isActive_createdAt_idx" ON "PricingAlert"("tenantId", "isActive", "createdAt");

DO $$ BEGIN
    ALTER TABLE "PricingCategory" ADD CONSTRAINT "PricingCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PricingItem" ADD CONSTRAINT "PricingItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PricingItem" ADD CONSTRAINT "PricingItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PricingCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PricingUpload" ADD CONSTRAINT "PricingUpload_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PricingUpload" ADD CONSTRAINT "PricingUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PricingChange" ADD CONSTRAINT "PricingChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PricingChange" ADD CONSTRAINT "PricingChange_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "PricingUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PricingAlert" ADD CONSTRAINT "PricingAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PricingAlert" ADD CONSTRAINT "PricingAlert_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "PricingUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
