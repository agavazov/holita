BEGIN;

ALTER TABLE "option" ADD COLUMN "showInListing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "optionValue" ADD COLUMN "swatchColor" VARCHAR(7),
  ADD CONSTRAINT "optionValue_swatchColor_check" CHECK ("swatchColor" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "productVariant" ADD COLUMN "imageId" UUID,
  ADD COLUMN "minimumQuantity" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "productVariant_minimumQuantity_check" CHECK ("minimumQuantity" > 0);

CREATE UNIQUE INDEX "productImage_tenantId_branchId_productId_id_key"
  ON "productImage" ("tenantId", "branchId", "productId", "id");
CREATE INDEX "productVariant_tenantId_branchId_productId_imageId_idx"
  ON "productVariant" ("tenantId", "branchId", "productId", "imageId");
ALTER TABLE "productVariant" ADD CONSTRAINT "product_variant_gallery_image_fkey"
  FOREIGN KEY ("tenantId", "branchId", "productId", "imageId")
  REFERENCES "productImage" ("tenantId", "branchId", "productId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT;
