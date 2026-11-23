ALTER TABLE "productVariant"
    ADD COLUMN "barcode" VARCHAR(255),
    ADD COLUMN "weight" DECIMAL(12,3),
    ADD COLUMN "width" DECIMAL(12,3),
    ADD COLUMN "height" DECIMAL(12,3),
    ADD COLUMN "depth" DECIMAL(12,3);

CREATE UNIQUE INDEX "productVariant_shop_barcode_lower_key"
    ON "productVariant" ("tenantId", "branchId", lower("barcode"))
    WHERE "barcode" IS NOT NULL;
