BEGIN;

-- CreateTable
CREATE TABLE "orderNotification" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "placedAt" TIMESTAMPTZ(3) NOT NULL,
    "readAt" TIMESTAMPTZ(3),

    CONSTRAINT "orderNotification_pkey" PRIMARY KEY ("tenantId","branchId","orderId")
);

-- CreateIndex
CREATE INDEX "orderNotification_tenantId_branchId_placedAt_orderId_idx" ON "orderNotification"("tenantId", "branchId", "placedAt" DESC, "orderId" DESC);

-- CreateIndex
CREATE INDEX "orderNotification_tenantId_branchId_readAt_idx" ON "orderNotification"("tenantId", "branchId", "readAt");

-- AddForeignKey
ALTER TABLE "orderNotification" ADD CONSTRAINT "orderNotification_tenantId_branchId_orderId_fkey" FOREIGN KEY ("tenantId", "branchId", "orderId") REFERENCES "order"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
