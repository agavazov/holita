BEGIN;

-- CreateEnum
CREATE TYPE "orderReturnStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "orderReturnOutcome" AS ENUM ('approved', 'rejected');

-- CreateTable
CREATE TABLE "orderReturnCase" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "orderReturnStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orderReturnCase_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orderReturnCase_reason_check" CHECK (btrim("reason") <> '')
);

-- CreateTable
CREATE TABLE "orderReturnLine" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "returnCaseId" UUID NOT NULL,
    "orderLineId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "orderReturnLine_pkey" PRIMARY KEY ("tenantId","branchId","orderId","returnCaseId","orderLineId"),
    CONSTRAINT "orderReturnLine_quantity_check" CHECK ("quantity" > 0)
);

-- CreateTable
CREATE TABLE "orderReturnDecision" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "returnCaseId" UUID NOT NULL,
    "outcome" "orderReturnOutcome" NOT NULL,
    "decidedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByUserId" UUID NOT NULL,

    CONSTRAINT "orderReturnDecision_pkey" PRIMARY KEY ("tenantId","branchId","returnCaseId")
);

-- CreateIndex
CREATE INDEX "orderReturnCase_tenantId_branchId_requestedAt_id_idx" ON "orderReturnCase"("tenantId", "branchId", "requestedAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orderReturnCase_tenantId_branchId_id_key" ON "orderReturnCase"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "orderReturnCase_tenantId_branchId_orderId_id_key" ON "orderReturnCase"("tenantId", "branchId", "orderId", "id");

-- CreateIndex
CREATE INDEX "orderReturnLine_tenantId_branchId_orderId_orderLineId_idx" ON "orderReturnLine"("tenantId", "branchId", "orderId", "orderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "orderLine_tenantId_branchId_orderId_id_key" ON "orderLine"("tenantId", "branchId", "orderId", "id");

-- AddForeignKey
ALTER TABLE "orderReturnCase" ADD CONSTRAINT "orderReturnCase_tenantId_branchId_orderId_fkey" FOREIGN KEY ("tenantId", "branchId", "orderId") REFERENCES "order"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orderReturnLine" ADD CONSTRAINT "orderReturnLine_tenantId_branchId_orderId_returnCaseId_fkey" FOREIGN KEY ("tenantId", "branchId", "orderId", "returnCaseId") REFERENCES "orderReturnCase"("tenantId", "branchId", "orderId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Order edits can reinsert a retained order line ID in the same transaction.
ALTER TABLE "orderReturnLine" ADD CONSTRAINT "orderReturnLine_tenantId_branchId_orderId_orderLineId_fkey" FOREIGN KEY ("tenantId", "branchId", "orderId", "orderLineId") REFERENCES "orderLine"("tenantId", "branchId", "orderId", "id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- AddForeignKey
ALTER TABLE "orderReturnDecision" ADD CONSTRAINT "orderReturnDecision_tenantId_branchId_returnCaseId_fkey" FOREIGN KEY ("tenantId", "branchId", "returnCaseId") REFERENCES "orderReturnCase"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
