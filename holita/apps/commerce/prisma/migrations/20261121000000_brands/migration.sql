CREATE TYPE "brandStatus" AS ENUM ('active', 'hidden');

CREATE TABLE "brand" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "logoKey" VARCHAR(41),
  "status" "brandStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_tenantId_branchId_id_key" ON "brand" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "brand_tenantId_branchId_slug_key" ON "brand" ("tenantId", "branchId", "slug");
CREATE UNIQUE INDEX "brand_tenantId_branchId_logoKey_key" ON "brand" ("tenantId", "branchId", "logoKey");
CREATE INDEX "brand_tenantId_branchId_name_id_idx" ON "brand" ("tenantId", "branchId", "name", "id");

ALTER TABLE "product" ADD COLUMN "brandId" UUID;
CREATE INDEX "product_tenantId_branchId_brandId_idx" ON "product" ("tenantId", "branchId", "brandId");
ALTER TABLE "product" ADD CONSTRAINT "product_tenantId_branchId_brandId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "brandId") REFERENCES "brand" ("tenantId", "branchId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
