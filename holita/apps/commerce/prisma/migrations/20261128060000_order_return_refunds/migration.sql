BEGIN;

-- AlterTable
ALTER TABLE "orderRefund" ADD COLUMN     "returnCaseId" UUID,
ADD COLUMN     "stockRestored" BOOLEAN;

-- CreateIndex
CREATE UNIQUE INDEX "orderRefund_tenantId_branchId_orderId_returnCaseId_key" ON "orderRefund"("tenantId", "branchId", "orderId", "returnCaseId");

-- AddForeignKey
ALTER TABLE "orderRefund" ADD CONSTRAINT "orderRefund_tenantId_branchId_orderId_returnCaseId_fkey" FOREIGN KEY ("tenantId", "branchId", "orderId", "returnCaseId") REFERENCES "orderReturnCase"("tenantId", "branchId", "orderId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;
