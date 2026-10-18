-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "termsUrl" TEXT,
    "permittedUseNotes" TEXT,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT false,
    "attributionText" TEXT,
    "requiresAuth" BOOLEAN NOT NULL DEFAULT false,
    "rateLimitPerMinute" INTEGER,
    "cacheTtlSeconds" INTEGER NOT NULL DEFAULT 86400,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "lastSuccessAt" DATETIME,
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TldRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tld" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "rdapBaseUrl" TEXT,
    "bootstrapUrl" TEXT,
    "status" TEXT NOT NULL,
    "supportsHead" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "registryName" TEXT,
    "termsUrl" TEXT,
    "verifiedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DomainSearchSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rawQuery" TEXT NOT NULL,
    "normalizedSld" TEXT NOT NULL,
    "requestedTlds" TEXT NOT NULL,
    "requestedCount" INTEGER NOT NULL,
    "checkedCount" INTEGER NOT NULL DEFAULT 0,
    "registeredCount" INTEGER NOT NULL DEFAULT 0,
    "notFoundCount" INTEGER NOT NULL DEFAULT 0,
    "unsupportedCount" INTEGER NOT NULL DEFAULT 0,
    "unresolvedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DomainVariantCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "candidateId" TEXT,
    "sourceId" TEXT NOT NULL,
    "tldId" TEXT NOT NULL,
    "fqdn" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "rawStatus" TEXT,
    "normalizedStatus" TEXT NOT NULL,
    "errorKind" TEXT,
    "errorDetails" TEXT,
    "responseMs" INTEGER,
    "isFresh" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DomainVariantCheck_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DomainSearchSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DomainVariantCheck_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DomainCandidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DomainVariantCheck_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DomainVariantCheck_tldId_fkey" FOREIGN KEY ("tldId") REFERENCES "TldRegistry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DomainCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fqdn" TEXT NOT NULL,
    "sld" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "tldId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "generationRule" TEXT,
    "seedTerms" TEXT,
    "score" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DomainCandidate_tldId_fkey" FOREIGN KEY ("tldId") REFERENCES "TldRegistry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AvailabilityCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "fqdn" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "rawStatus" TEXT,
    "normalizedStatus" TEXT NOT NULL,
    "errorKind" TEXT,
    "errorDetails" TEXT,
    "responseMs" INTEGER,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "isFresh" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "AvailabilityCheck_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DomainCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AvailabilityCheck_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DomainObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valueText" TEXT,
    "valueNumeric" REAL,
    "valueBool" BOOLEAN,
    "sourceLabel" TEXT,
    "sourceUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DomainObservation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DomainCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT,
    "sourceId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "evidenceType" TEXT NOT NULL,
    "reliability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "confidence" INTEGER,
    "url" TEXT,
    "summary" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retrievalStatus" TEXT NOT NULL DEFAULT 'OK',
    "rawPayloadRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceRecord_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DomainCandidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EvidenceRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleComparable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "sld" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priceUsd" REAL,
    "fxRateUsed" REAL,
    "fxCapturedAt" DATETIME,
    "saleDate" DATETIME,
    "venue" TEXT,
    "saleType" TEXT,
    "sourceUrl" TEXT,
    "sourceLabel" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'REPORTED',
    "notes" TEXT,
    "importJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SaleComparable_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AggregateMarketStatistic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "placement" TEXT,
    "period" TEXT,
    "saleCount" INTEGER,
    "priceSum" REAL,
    "priceAvg" REAL,
    "priceMax" REAL,
    "priceStddev" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "attribution" TEXT NOT NULL,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUrl" TEXT,
    CONSTRAINT "AggregateMarketStatistic_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrendObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT,
    "subject" TEXT NOT NULL,
    "sector" TEXT,
    "metric" TEXT NOT NULL,
    "valueNumeric" REAL,
    "region" TEXT,
    "observedAt" DATETIME NOT NULL,
    "granularity" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrendObservation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "dedupeHash" TEXT NOT NULL,
    "publisher" TEXT,
    "publishedAt" DATETIME,
    "snippet" TEXT,
    "sector" TEXT,
    "product" TEXT,
    "technology" TEXT,
    "buyerType" TEXT,
    "useCase" TEXT,
    "investorNote" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsArticle_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanyProspect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "sector" TEXT,
    "product" TEXT,
    "geography" TEXT,
    "rationale" TEXT NOT NULL,
    "standing" TEXT NOT NULL DEFAULT 'PROSPECT',
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "evidenceDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanyProspect_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrademarkReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT,
    "term" TEXT NOT NULL,
    "variant" TEXT,
    "jurisdiction" TEXT,
    "classes" TEXT,
    "status" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "reviewedAt" DATETIME,
    "reviewerNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrademarkReview_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvestmentAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "dimensionScores" TEXT NOT NULL,
    "totalScore" REAL,
    "evidenceCoverage" INTEGER,
    "confidence" INTEGER,
    "availabilityFresh" BOOLEAN NOT NULL DEFAULT false,
    "trademarkGate" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "decision" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "valuation" TEXT,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideBy" TEXT,
    "overrideAt" DATETIME,
    "overrideReason" TEXT,
    "parentAssessmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentAssessment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DomainCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT,
    "domain" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "acquisitionDate" DATETIME,
    "registrationCost" REAL,
    "registrationCurrency" TEXT NOT NULL DEFAULT 'USD',
    "renewalDate" DATETIME,
    "renewalCost" REAL,
    "registrar" TEXT,
    "targetAskPrice" REAL,
    "askCurrency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortfolioHolding_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DomainCandidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "holdingId" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "listingUrl" TEXT,
    "askPrice" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "listedAt" DATETIME,
    "delistedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'LISTED',
    "salePrice" REAL,
    "saleCurrency" TEXT,
    "soldAt" DATETIME,
    "commissionPct" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingRecord_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "PortfolioHolding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DomainCandidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchExperiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" TEXT NOT NULL,
    "modelVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "filename" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errors" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScheduledJobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobKey" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorDetails" TEXT,
    "isDryRun" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ScheduledJobRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "defaultTlds" TEXT NOT NULL,
    "requestBudgetPerRun" INTEGER NOT NULL DEFAULT 200,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 2,
    "requestDelayMs" INTEGER NOT NULL DEFAULT 1000,
    "fxRateSource" TEXT NOT NULL DEFAULT 'manual',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "investorNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE INDEX "Source_status_idx" ON "Source"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TldRegistry_tld_key" ON "TldRegistry"("tld");

-- CreateIndex
CREATE INDEX "TldRegistry_status_idx" ON "TldRegistry"("status");

-- CreateIndex
CREATE INDEX "TldRegistry_isDefault_idx" ON "TldRegistry"("isDefault");

-- CreateIndex
CREATE INDEX "DomainSearchSession_normalizedSld_idx" ON "DomainSearchSession"("normalizedSld");

-- CreateIndex
CREATE INDEX "DomainSearchSession_status_idx" ON "DomainSearchSession"("status");

-- CreateIndex
CREATE INDEX "DomainVariantCheck_fqdn_checkedAt_idx" ON "DomainVariantCheck"("fqdn", "checkedAt");

-- CreateIndex
CREATE INDEX "DomainVariantCheck_candidateId_tldId_idx" ON "DomainVariantCheck"("candidateId", "tldId");

-- CreateIndex
CREATE INDEX "DomainVariantCheck_normalizedStatus_idx" ON "DomainVariantCheck"("normalizedStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DomainCandidate_fqdn_key" ON "DomainCandidate"("fqdn");

-- CreateIndex
CREATE INDEX "DomainCandidate_sld_idx" ON "DomainCandidate"("sld");

-- CreateIndex
CREATE INDEX "DomainCandidate_tldId_idx" ON "DomainCandidate"("tldId");

-- CreateIndex
CREATE INDEX "DomainCandidate_status_idx" ON "DomainCandidate"("status");

-- CreateIndex
CREATE INDEX "AvailabilityCheck_normalizedStatus_idx" ON "AvailabilityCheck"("normalizedStatus");

-- CreateIndex
CREATE INDEX "AvailabilityCheck_checkedAt_idx" ON "AvailabilityCheck"("checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityCheck_candidateId_sourceId_key" ON "AvailabilityCheck"("candidateId", "sourceId");

-- CreateIndex
CREATE INDEX "DomainObservation_candidateId_kind_observedAt_idx" ON "DomainObservation"("candidateId", "kind", "observedAt");

-- CreateIndex
CREATE INDEX "EvidenceRecord_candidateId_idx" ON "EvidenceRecord"("candidateId");

-- CreateIndex
CREATE INDEX "EvidenceRecord_subjectType_subjectId_idx" ON "EvidenceRecord"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "EvidenceRecord_evidenceType_idx" ON "EvidenceRecord"("evidenceType");

-- CreateIndex
CREATE INDEX "SaleComparable_sld_idx" ON "SaleComparable"("sld");

-- CreateIndex
CREATE INDEX "SaleComparable_tld_idx" ON "SaleComparable"("tld");

-- CreateIndex
CREATE INDEX "SaleComparable_saleDate_idx" ON "SaleComparable"("saleDate");

-- CreateIndex
CREATE INDEX "SaleComparable_verificationStatus_idx" ON "SaleComparable"("verificationStatus");

-- CreateIndex
CREATE INDEX "AggregateMarketStatistic_scope_key_idx" ON "AggregateMarketStatistic"("scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AggregateMarketStatistic_sourceId_scope_key_placement_period_key" ON "AggregateMarketStatistic"("sourceId", "scope", "key", "placement", "period");

-- CreateIndex
CREATE INDEX "TrendObservation_subject_observedAt_idx" ON "TrendObservation"("subject", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_dedupeHash_key" ON "NewsArticle"("dedupeHash");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_sector_idx" ON "NewsArticle"("sector");

-- CreateIndex
CREATE INDEX "CompanyProspect_sector_idx" ON "CompanyProspect"("sector");

-- CreateIndex
CREATE INDEX "TrademarkReview_term_idx" ON "TrademarkReview"("term");

-- CreateIndex
CREATE INDEX "TrademarkReview_riskLevel_idx" ON "TrademarkReview"("riskLevel");

-- CreateIndex
CREATE INDEX "InvestmentAssessment_candidateId_createdAt_idx" ON "InvestmentAssessment"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "InvestmentAssessment_decision_idx" ON "InvestmentAssessment"("decision");

-- CreateIndex
CREATE INDEX "PortfolioHolding_domain_idx" ON "PortfolioHolding"("domain");

-- CreateIndex
CREATE INDEX "PortfolioHolding_status_idx" ON "PortfolioHolding"("status");

-- CreateIndex
CREATE INDEX "ListingRecord_holdingId_status_idx" ON "ListingRecord"("holdingId", "status");

-- CreateIndex
CREATE INDEX "Alert_isRead_createdAt_idx" ON "Alert"("isRead", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduledJobRun_jobKey_startedAt_idx" ON "ScheduledJobRun"("jobKey", "startedAt");
