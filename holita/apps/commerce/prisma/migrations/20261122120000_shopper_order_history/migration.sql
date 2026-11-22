BEGIN;

ALTER TYPE "orderStatus" ADD VALUE 'completed';

CREATE INDEX "order_tenantId_branchId_customerId_placedAt_id_idx"
  ON "order" ("tenantId", "branchId", "customerId", "placedAt" DESC, "id" DESC);

COMMIT;
