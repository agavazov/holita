-- Stop BGN Commerce processes and seed writers before applying this migration.
-- Start EUR Commerce and seed writers after it commits.
BEGIN;

CREATE TYPE "bgnToEurAmountKind" AS ENUM (
  'variantPrice',
  'shippingFee',
  'fixedDiscount',
  'discountMinSubtotal'
);

-- Keep the source and converted amounts even when live records are later replaced or deleted.
CREATE TABLE "bgnToEurAmount" (
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "kind" "bgnToEurAmountKind" NOT NULL,
  "recordId" UUID NOT NULL,
  "amountBgn" DECIMAL(32,2) NOT NULL,
  "amountEur" DECIMAL(32,2) NOT NULL,
  CONSTRAINT "bgnToEurAmount_pkey" PRIMARY KEY ("tenantId", "branchId", "kind", "recordId")
);

-- Existing live amounts are decimal BGN. The ECB rate is BGN 1.95583 per EUR.
-- https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.pr260101~c830245e42.en.html
-- Keep enough division precision to round large discount amounts directly to cents.
INSERT INTO "bgnToEurAmount" ("tenantId", "branchId", "kind", "recordId", "amountBgn", "amountEur")
SELECT "tenantId", "branchId", kind::"bgnToEurAmountKind", "id", amount,
       round(amount / 1.95583::numeric(12, 10), 2)
FROM (
  SELECT "tenantId", "branchId", 'variantPrice' AS kind, "id", "price" AS amount
  FROM "productVariant"
  UNION ALL
  SELECT "tenantId", "branchId", 'shippingFee', "id", "fixedFee"
  FROM "shippingMethod"
  UNION ALL
  SELECT "tenantId", "branchId", 'fixedDiscount', "id", "value"
  FROM "discount"
  WHERE "type" = 'fixed'
  UNION ALL
  SELECT "tenantId", "branchId", 'discountMinSubtotal', "id", "minSubtotal"
  FROM "discount"
  WHERE "minSubtotal" IS NOT NULL
) AS source;

UPDATE "productVariant" AS variant
SET "price" = cutover."amountEur"
FROM "bgnToEurAmount" AS cutover
WHERE cutover."kind" = 'variantPrice'
  AND (variant."tenantId", variant."branchId", variant."id") =
      (cutover."tenantId", cutover."branchId", cutover."recordId");

UPDATE "shippingMethod" AS shipping
SET "fixedFee" = cutover."amountEur"
FROM "bgnToEurAmount" AS cutover
WHERE cutover."kind" = 'shippingFee'
  AND (shipping."tenantId", shipping."branchId", shipping."id") =
      (cutover."tenantId", cutover."branchId", cutover."recordId");

UPDATE "discount" AS discount
SET "value" = cutover."amountEur"
FROM "bgnToEurAmount" AS cutover
WHERE cutover."kind" = 'fixedDiscount'
  AND (discount."tenantId", discount."branchId", discount."id") =
      (cutover."tenantId", cutover."branchId", cutover."recordId");

UPDATE "discount" AS discount
SET "minSubtotal" = cutover."amountEur"
FROM "bgnToEurAmount" AS cutover
WHERE cutover."kind" = 'discountMinSubtotal'
  AND (discount."tenantId", discount."branchId", discount."id") =
      (cutover."tenantId", cutover."branchId", cutover."recordId");

COMMIT;
