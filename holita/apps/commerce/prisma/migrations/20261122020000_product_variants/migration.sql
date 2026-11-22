BEGIN;

CREATE TABLE "productVariant" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "inventoryTracked" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "combinationKey" CHAR(64) NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "productVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "productVariant_price_check" CHECK ("price" >= 0),
  CONSTRAINT "productVariant_quantity_check" CHECK ("quantity" >= 0)
);

CREATE TABLE "productVariantValue" (
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "optionValueId" UUID NOT NULL,
  CONSTRAINT "productVariantValue_pkey" PRIMARY KEY ("tenantId", "branchId", "variantId", "optionValueId")
);

CREATE UNIQUE INDEX "optionValue_tenantId_branchId_id_key" ON "optionValue" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "productVariant_tenantId_branchId_id_key" ON "productVariant" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "productVariant_tenantId_branchId_sku_key" ON "productVariant" ("tenantId", "branchId", "sku");
CREATE UNIQUE INDEX "productVariant_product_combination_key" ON "productVariant" ("tenantId", "branchId", "productId", "combinationKey");
CREATE INDEX "productVariant_tenantId_branchId_productId_active_price_idx" ON "productVariant" ("tenantId", "branchId", "productId", "active", "price");
CREATE INDEX "productVariantValue_tenantId_branchId_optionValueId_idx" ON "productVariantValue" ("tenantId", "branchId", "optionValueId");

ALTER TABLE "productVariant" ADD CONSTRAINT "productVariant_tenantId_branchId_productId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "productId") REFERENCES "product" ("tenantId", "branchId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "productVariantValue" ADD CONSTRAINT "productVariantValue_tenantId_branchId_variantId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "variantId") REFERENCES "productVariant" ("tenantId", "branchId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "productVariantValue" ADD CONSTRAINT "productVariantValue_tenantId_branchId_optionValueId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "optionValueId") REFERENCES "optionValue" ("tenantId", "branchId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "productVariant" ("id", "tenantId", "branchId", "productId", "sku", "price", "combinationKey", "sortOrder")
SELECT "id", "tenantId", "branchId", "id", 'LEGACY-' || "id"::text, "price", encode(sha256(''::bytea), 'hex'), 0
FROM "product";

-- Keep historical values while making variants the only price source for new writes.
ALTER TABLE "product" ALTER COLUMN "price" DROP NOT NULL;

COMMIT;
