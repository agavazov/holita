BEGIN;

ALTER TABLE "orderLine"
  ADD COLUMN "stockDeductedQuantity" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "stockDecremented" SET DEFAULT false;

UPDATE "orderLine" SET "stockDeductedQuantity" = "quantity" WHERE "stockDecremented";

ALTER TABLE "orderLine"
  ADD CONSTRAINT "orderLine_stockDeductedQuantity_check"
    CHECK ("stockDeductedQuantity" BETWEEN 0 AND "quantity");

COMMIT;
