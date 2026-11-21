CREATE TABLE "category" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "parentId" UUID,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "category_parent_not_self_check" CHECK ("id" <> "parentId"),
  CONSTRAINT "category_sortOrder_check" CHECK ("sortOrder" >= 0)
);

CREATE UNIQUE INDEX "category_tenantId_branchId_id_key" ON "category" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "category_tenantId_branchId_slug_key" ON "category" ("tenantId", "branchId", "slug");
CREATE INDEX "category_tenantId_branchId_parentId_idx" ON "category" ("tenantId", "branchId", "parentId");
ALTER TABLE "category" ADD CONSTRAINT "category_tenantId_branchId_parentId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "parentId") REFERENCES "category" ("tenantId", "branchId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "product" ADD COLUMN "categoryId" UUID;
CREATE INDEX "product_tenantId_branchId_categoryId_idx" ON "product" ("tenantId", "branchId", "categoryId");
ALTER TABLE "product" ADD CONSTRAINT "product_tenantId_branchId_categoryId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "categoryId") REFERENCES "category" ("tenantId", "branchId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
