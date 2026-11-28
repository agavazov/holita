BEGIN;

-- AlterTable
ALTER TABLE "order" ADD COLUMN "emailLanguage" VARCHAR(2) NOT NULL DEFAULT 'bg',
    ADD CONSTRAINT "order_emailLanguage_check" CHECK ("emailLanguage" IN ('bg', 'en'));

-- CreateTable
CREATE TABLE "localEmail" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "template" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "recipient" VARCHAR(254) NOT NULL,
    "language" VARCHAR(2) NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "localEmail_pkey" PRIMARY KEY ("tenantId", "branchId", "template", "sourceEventId"),
    CONSTRAINT "localEmail_language_check" CHECK ("language" IN ('bg', 'en'))
);

COMMIT;
