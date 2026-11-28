BEGIN;

ALTER TABLE "orderReturnCase"
  ADD COLUMN "completedAt" TIMESTAMPTZ(3),
  ADD COLUMN "completionStockRestored" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
