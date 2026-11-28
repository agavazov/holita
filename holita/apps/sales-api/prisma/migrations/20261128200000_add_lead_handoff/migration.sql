BEGIN;

-- CreateEnum
CREATE TYPE "leadHandoffMode" AS ENUM ('newMerchant');

-- CreateEnum
CREATE TYPE "leadHandoffState" AS ENUM ('pending', 'rejected', 'completed');

-- CreateTable
CREATE TABLE "leadHandoff" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "mode" "leadHandoffMode" NOT NULL DEFAULT 'newMerchant',
    "state" "leadHandoffState" NOT NULL DEFAULT 'pending',
    "initiatedByUserId" UUID NOT NULL,
    "merchantName" VARCHAR(200),
    "adminName" VARCHAR(200),
    "adminEmail" VARCHAR(254),
    "branchName" VARCHAR(200),
    "merchantTenantId" UUID,
    "branchId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "leadHandoff_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "leadHandoff_state_check" CHECK (
        (
            "state" = 'completed'
            AND "merchantTenantId" IS NOT NULL AND "branchId" IS NOT NULL AND "completedAt" IS NOT NULL
            AND "merchantName" IS NULL AND "adminName" IS NULL AND "adminEmail" IS NULL AND "branchName" IS NULL
        ) OR (
            "state" <> 'completed'
            AND "merchantTenantId" IS NULL AND "branchId" IS NULL AND "completedAt" IS NULL
            AND "merchantName" IS NOT NULL AND "adminName" IS NOT NULL AND "adminEmail" IS NOT NULL AND "branchName" IS NOT NULL
        )
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "leadHandoff_tenantId_leadId_key" ON "leadHandoff"("tenantId", "leadId");

-- AddForeignKey
ALTER TABLE "leadHandoff" ADD CONSTRAINT "leadHandoff_tenantId_leadId_fkey" FOREIGN KEY ("tenantId", "leadId") REFERENCES "lead"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

