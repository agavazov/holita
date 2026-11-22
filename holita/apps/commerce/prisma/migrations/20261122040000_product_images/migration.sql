CREATE TABLE "productImage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "storageKey" VARCHAR(41) NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "productImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "productImage_tenantId_branchId_storageKey_key" ON "productImage"("tenantId", "branchId", "storageKey");
CREATE INDEX "productImage_tenantId_branchId_productId_sortOrder_id_idx" ON "productImage"("tenantId", "branchId", "productId", "sortOrder", "id");

ALTER TABLE "productImage" ADD CONSTRAINT "productImage_tenantId_branchId_productId_fkey" FOREIGN KEY ("tenantId", "branchId", "productId") REFERENCES "product"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
