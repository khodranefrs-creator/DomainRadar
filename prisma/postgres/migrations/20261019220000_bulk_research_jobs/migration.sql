-- CreateTable
CREATE TABLE "ResearchJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BULK_AVAILABILITY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rawInput" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "requestedTlds" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "runningCount" INTEGER NOT NULL DEFAULT 0,
    "doneCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "maxItems" INTEGER NOT NULL DEFAULT 3000,
    "maxTlds" INTEGER NOT NULL DEFAULT 20,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchJobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sld" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "fqdn" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "normalizedStatus" TEXT,
    "httpStatus" INTEGER,
    "providerHost" TEXT,
    "requestUrl" TEXT,
    "errorKind" TEXT,
    "errorDetails" TEXT,
    "responseMs" INTEGER,
    "isFresh" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchJob_status_updatedAt_idx" ON "ResearchJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ResearchJob_createdAt_idx" ON "ResearchJob"("createdAt");

-- CreateIndex
CREATE INDEX "ResearchJobItem_jobId_status_idx" ON "ResearchJobItem"("jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchJobItem_jobId_fqdn_key" ON "ResearchJobItem"("jobId", "fqdn");

-- AddForeignKey
ALTER TABLE "ResearchJobItem" ADD CONSTRAINT "ResearchJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ResearchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
