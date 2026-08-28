CREATE TABLE "MobileLearningEvent" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "clientEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "contentId" TEXT,
  "contentVersion" INTEGER,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "serverSequence" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MobileLearningEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileSyncCursor" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "nextSequence" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobileSyncCursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileLearningEvent_tenantId_userId_clientEventId_key" ON "MobileLearningEvent"("tenantId", "userId", "clientEventId");
CREATE UNIQUE INDEX "MobileLearningEvent_tenantId_userId_serverSequence_key" ON "MobileLearningEvent"("tenantId", "userId", "serverSequence");
CREATE INDEX "MobileLearningEvent_tenantId_userId_occurredAt_idx" ON "MobileLearningEvent"("tenantId", "userId", "occurredAt");
CREATE UNIQUE INDEX "MobileSyncCursor_userId_key" ON "MobileSyncCursor"("userId");
CREATE UNIQUE INDEX "MobileSyncCursor_tenantId_userId_key" ON "MobileSyncCursor"("tenantId", "userId");
CREATE INDEX "MobileSyncCursor_tenantId_idx" ON "MobileSyncCursor"("tenantId");

ALTER TABLE "MobileLearningEvent" ADD CONSTRAINT "MobileLearningEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileLearningEvent" ADD CONSTRAINT "MobileLearningEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileSyncCursor" ADD CONSTRAINT "MobileSyncCursor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileSyncCursor" ADD CONSTRAINT "MobileSyncCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
