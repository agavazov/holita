BEGIN;

-- CreateEnum
CREATE TYPE "customerDataExportOutcome" AS ENUM ('exported', 'notFound');

-- CreateTable
CREATE TABLE "customerDataExportAudit" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "outcome" "customerDataExportOutcome" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customerDataExportAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customerDataExportAudit_tenantId_branchId_customerId_create_idx" ON "customerDataExportAudit"("tenantId", "branchId", "customerId", "createdAt");


COMMIT;
