BEGIN;

-- CreateEnum
CREATE TYPE "salesOfferStatus" AS ENUM ('draft');

-- CreateTable
CREATE TABLE "salesOffer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "leadId" UUID,
    "authorUserId" UUID NOT NULL,
    "status" "salesOfferStatus" NOT NULL DEFAULT 'draft',
    "recipientName" VARCHAR(255),
    "recipientEmail" VARCHAR(254),
    "replyEmail" VARCHAR(254),
    "replyPhone" VARCHAR(255),
    "currentSiteUrl" VARCHAR(2048),
    "proposedSiteUrl" VARCHAR(2048),
    "exampleDomain" VARCHAR(253),
    "validUntil" DATE,
    "productCount" INTEGER,
    "categoryCount" INTEGER,
    "languages" VARCHAR(120),
    "currentPlatform" VARCHAR(120),
    "message" TEXT,
    "includedScope" TEXT,
    "recommendedPlanName" VARCHAR(80),
    "recommendedMonthlyPrice" DECIMAL(8,2),
    "alternativePlanName" VARCHAR(80),
    "alternativeMonthlyPrice" DECIMAL(8,2),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "salesOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salesOffer_tenantId_authorUserId_updatedAt_id_idx" ON "salesOffer"("tenantId", "authorUserId", "updatedAt" DESC, "id");

-- CreateIndex
CREATE INDEX "salesOffer_tenantId_leadId_authorUserId_idx" ON "salesOffer"("tenantId", "leadId", "authorUserId");

-- AddForeignKey
ALTER TABLE "salesOffer" ADD CONSTRAINT "salesOffer_tenantId_leadId_fkey" FOREIGN KEY ("tenantId", "leadId") REFERENCES "lead"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep both parts of each optional quote line together.
ALTER TABLE "salesOffer"
    ADD CONSTRAINT "salesOffer_recommended_quote_check" CHECK (
        ("recommendedPlanName" IS NULL AND "recommendedMonthlyPrice" IS NULL)
        OR ("recommendedPlanName" IS NOT NULL AND btrim("recommendedPlanName") <> ''
            AND "recommendedMonthlyPrice" IS NOT NULL AND "recommendedMonthlyPrice" >= 0)
    ),
    ADD CONSTRAINT "salesOffer_alternative_quote_check" CHECK (
        ("alternativePlanName" IS NULL AND "alternativeMonthlyPrice" IS NULL)
        OR ("alternativePlanName" IS NOT NULL AND btrim("alternativePlanName") <> ''
            AND "alternativeMonthlyPrice" IS NOT NULL AND "alternativeMonthlyPrice" >= 0)
    ),
    ADD CONSTRAINT "salesOffer_count_check" CHECK ("productCount" >= 0 AND "categoryCount" >= 0);

COMMIT;
