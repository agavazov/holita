BEGIN;

ALTER TYPE "orderStatus" ADD VALUE 'confirmed' BEFORE 'completed';
ALTER TYPE "orderStatus" ADD VALUE 'processing' BEFORE 'completed';
ALTER TYPE "orderStatus" ADD VALUE 'shipped' BEFORE 'completed';
ALTER TYPE "orderStatus" ADD VALUE 'cancelled';
ALTER TYPE "orderPaymentStatus" ADD VALUE 'paid';

ALTER TABLE "order" ADD COLUMN "paidAt" TIMESTAMPTZ(3);

CREATE INDEX "order_tenantId_branchId_placedAt_id_idx"
  ON "order" ("tenantId", "branchId", "placedAt" DESC, "id" DESC);

CREATE TABLE "orderStatusChange" (
  "id" SERIAL NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "fromStatus" "orderStatus" NOT NULL,
  "toStatus" "orderStatus" NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "orderStatusChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orderStatusChange_tenantId_branchId_orderId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "orderId") REFERENCES "order" ("tenantId", "branchId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "orderStatusChange_tenantId_branchId_orderId_id_idx"
  ON "orderStatusChange" ("tenantId", "branchId", "orderId", "id");

COMMIT;
