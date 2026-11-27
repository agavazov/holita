BEGIN;

CREATE TABLE "productVariantPriceHistory" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "productVariantPriceHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "productVariantPriceHistory_price_check" CHECK ("price" >= 0)
);

CREATE INDEX "productVariantPriceHistory_variant_recordedAt_idx"
  ON "productVariantPriceHistory" ("tenantId", "branchId", "variantId", "recordedAt");

COMMIT;
