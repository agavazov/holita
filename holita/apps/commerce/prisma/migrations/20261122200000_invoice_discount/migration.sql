BEGIN;

ALTER TABLE "invoice" ADD COLUMN "discountAmount" DECIMAL(32, 2) NOT NULL DEFAULT 0;

UPDATE "invoice" AS invoice
SET "discountAmount" = source_order."discountAmount"
FROM "order" AS source_order
WHERE invoice."tenantId" = source_order."tenantId"
  AND invoice."branchId" = source_order."branchId"
  AND invoice."orderId" = source_order."id"
  AND source_order."discountAmount" > 0;

COMMIT;
