BEGIN;

-- CreateEnum
CREATE TYPE "catalogueImportRowStatus" AS ENUM ('applied', 'rejected');

-- CreateTable
CREATE TABLE "catalogueImportJob" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogueImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogueImportRow" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "normalizedInput" TEXT[],
    "status" "catalogueImportRowStatus",
    "errorCode" TEXT,
    "error" TEXT,

    CONSTRAINT "catalogueImportRow_pkey" PRIMARY KEY ("tenantId","branchId","jobId","rowNumber"),
    CONSTRAINT "catalogueImportRow_input_check" CHECK ("rowNumber" > 1 AND "normalizedInput" IS NOT NULL),
    CONSTRAINT "catalogueImportRow_outcome_check" CHECK (
        ("status" IS NOT DISTINCT FROM 'rejected') = ("errorCode" IS NOT NULL)
        AND ("errorCode" IS NULL) = ("error" IS NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "catalogueImportJob_tenantId_branchId_id_key" ON "catalogueImportJob"("tenantId", "branchId", "id");

-- AddForeignKey
ALTER TABLE "catalogueImportRow" ADD CONSTRAINT "catalogueImportRow_tenantId_branchId_jobId_fkey" FOREIGN KEY ("tenantId", "branchId", "jobId") REFERENCES "catalogueImportJob"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
