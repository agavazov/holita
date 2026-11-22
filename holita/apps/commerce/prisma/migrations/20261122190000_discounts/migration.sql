BEGIN;

CREATE TYPE "discountType" AS ENUM ('percentage', 'fixed');

CREATE TABLE "discount" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "type" "discountType" NOT NULL,
  "value" DECIMAL(32,2) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMPTZ(3),
  "endsAt" TIMESTAMPTZ(3),
  "minSubtotal" DECIMAL(32,2),
  "usageLimit" INTEGER,
  "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "discount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discount_value_check"
    CHECK ("value" > 0 AND ("type" <> 'percentage' OR "value" <= 100)),
  CONSTRAINT "discount_minSubtotal_check" CHECK ("minSubtotal" >= 0),
  CONSTRAINT "discount_usageLimit_check" CHECK ("usageLimit" > 0),
  CONSTRAINT "discount_window_check" CHECK ("startsAt" < "endsAt")
);

CREATE UNIQUE INDEX "discount_tenantId_branchId_id_key" ON "discount" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "discount_tenantId_branchId_code_key" ON "discount" ("tenantId", "branchId", "code");

ALTER TABLE "cart" ADD COLUMN "discountId" UUID;
CREATE INDEX "cart_tenantId_branchId_discountId_idx" ON "cart" ("tenantId", "branchId", "discountId");
ALTER TABLE "cart" ADD CONSTRAINT "cart_tenantId_branchId_discountId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "discountId") REFERENCES "discount" ("tenantId", "branchId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order"
  ADD COLUMN "discountCode" VARCHAR(64),
  ADD COLUMN "discountAmount" DECIMAL(32,2) NOT NULL DEFAULT 0;

COMMIT;
