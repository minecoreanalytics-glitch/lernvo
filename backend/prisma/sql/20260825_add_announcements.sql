-- Additive schema for tenant-scoped company news (Actualités).
--   npx prisma db push
--   psql "$DATABASE_URL" -f prisma/sql/20260825_add_announcements.sql

CREATE TABLE IF NOT EXISTS "CompanyUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyUnitId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyUnit_tenantId_slug_key" ON "CompanyUnit"("tenantId", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyUnit_tenantId_name_key" ON "CompanyUnit"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "CompanyUnit_tenantId_isActive_idx" ON "CompanyUnit"("tenantId", "isActive");

CREATE INDEX IF NOT EXISTS "Announcement_tenantId_createdAt_idx" ON "Announcement"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Announcement_companyUnitId_idx" ON "Announcement"("companyUnitId");
CREATE INDEX IF NOT EXISTS "Announcement_authorId_idx" ON "Announcement"("authorId");

CREATE UNIQUE INDEX IF NOT EXISTS "AnnouncementRead_tenantId_userId_announcementId_key" ON "AnnouncementRead"("tenantId", "userId", "announcementId");
CREATE INDEX IF NOT EXISTS "AnnouncementRead_userId_idx" ON "AnnouncementRead"("userId");
CREATE INDEX IF NOT EXISTS "AnnouncementRead_announcementId_idx" ON "AnnouncementRead"("announcementId");

DO $$ BEGIN
  ALTER TABLE "CompanyUnit" ADD CONSTRAINT "CompanyUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_companyUnitId_fkey" FOREIGN KEY ("companyUnitId") REFERENCES "CompanyUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
