CREATE TABLE "orderRefund" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "amount" DECIMAL(32, 2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "reason" TEXT,
  "restock" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orderRefund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orderRefund_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "orderRefund_tenantId_branchId_orderId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "orderId") REFERENCES "order" ("tenantId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "orderRefund_tenantId_branchId_orderId_createdAt_id_idx"
  ON "orderRefund" ("tenantId", "branchId", "orderId", "createdAt" DESC, "id" DESC);
