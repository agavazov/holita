-- CreateEnum
CREATE TYPE "productCollectionMode" AS ENUM ('manual', 'category', 'brand');

-- CreateTable
CREATE TABLE "productCollection" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mode" "productCollectionMode" NOT NULL,
    "categoryId" UUID,
    "brandId" UUID,

    CONSTRAINT "productCollection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "productCollection_mode_check" CHECK (
        ("mode" = 'manual' AND "categoryId" IS NULL AND "brandId" IS NULL)
        OR ("mode" = 'category' AND "categoryId" IS NOT NULL AND "brandId" IS NULL)
        OR ("mode" = 'brand' AND "categoryId" IS NULL AND "brandId" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "productCollectionItem" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "productCollectionItem_pkey" PRIMARY KEY ("tenantId","branchId","collectionId","productId")
);

-- CreateIndex
CREATE INDEX "productCollection_tenantId_branchId_categoryId_idx" ON "productCollection"("tenantId", "branchId", "categoryId");

-- CreateIndex
CREATE INDEX "productCollection_tenantId_branchId_brandId_idx" ON "productCollection"("tenantId", "branchId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "productCollection_tenantId_branchId_id_key" ON "productCollection"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "productCollection_tenantId_branchId_slug_key" ON "productCollection"("tenantId", "branchId", "slug");

-- CreateIndex
CREATE INDEX "productCollectionItem_tenantId_branchId_productId_idx" ON "productCollectionItem"("tenantId", "branchId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "productCollectionItem_tenantId_branchId_collectionId_sortOr_key" ON "productCollectionItem"("tenantId", "branchId", "collectionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "productCollection" ADD CONSTRAINT "productCollection_tenantId_branchId_categoryId_fkey" FOREIGN KEY ("tenantId", "branchId", "categoryId") REFERENCES "category"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productCollection" ADD CONSTRAINT "productCollection_tenantId_branchId_brandId_fkey" FOREIGN KEY ("tenantId", "branchId", "brandId") REFERENCES "brand"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productCollectionItem" ADD CONSTRAINT "productCollectionItem_tenantId_branchId_collectionId_fkey" FOREIGN KEY ("tenantId", "branchId", "collectionId") REFERENCES "productCollection"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productCollectionItem" ADD CONSTRAINT "productCollectionItem_tenantId_branchId_productId_fkey" FOREIGN KEY ("tenantId", "branchId", "productId") REFERENCES "product"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

