CREATE TYPE "navigationPlacement" AS ENUM ('header', 'footer');
CREATE TYPE "navigationDestinationType" AS ENUM ('category', 'collection', 'page', 'blog', 'url');

CREATE TABLE "navigationMenu" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "placement" "navigationPlacement" NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "navigationMenu_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "navigationMenuItem" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "menuId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "labelBg" VARCHAR(200),
  "labelEn" VARCHAR(200),
  "destinationType" "navigationDestinationType" NOT NULL,
  "categoryId" UUID,
  "collectionId" UUID,
  "pageId" UUID,
  "url" VARCHAR(2048),
  CONSTRAINT "navigationMenuItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "navigationMenuItem_destination_check" CHECK (
    ("categoryId" IS NOT NULL) = ("destinationType" = 'category') AND
    ("collectionId" IS NOT NULL) = ("destinationType" = 'collection') AND
    ("pageId" IS NOT NULL) = ("destinationType" = 'page') AND
    ("url" IS NOT NULL) = ("destinationType" = 'url')
  )
);

CREATE UNIQUE INDEX "navigationMenu_tenantId_branchId_id_key" ON "navigationMenu" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "navigationMenu_tenantId_branchId_placement_key" ON "navigationMenu" ("tenantId", "branchId", "placement");
CREATE UNIQUE INDEX "navigationMenuItem_tenantId_branchId_menuId_sortOrder_key" ON "navigationMenuItem" ("tenantId", "branchId", "menuId", "sortOrder");
CREATE INDEX "navigationMenuItem_tenantId_branchId_categoryId_idx" ON "navigationMenuItem" ("tenantId", "branchId", "categoryId");
CREATE INDEX "navigationMenuItem_tenantId_branchId_collectionId_idx" ON "navigationMenuItem" ("tenantId", "branchId", "collectionId");
CREATE INDEX "navigationMenuItem_tenantId_branchId_pageId_idx" ON "navigationMenuItem" ("tenantId", "branchId", "pageId");

ALTER TABLE "navigationMenuItem" ADD CONSTRAINT "navigationMenuItem_tenantId_branchId_menuId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "menuId") REFERENCES "navigationMenu" ("tenantId", "branchId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "navigationMenuItem" ADD CONSTRAINT "navigationMenuItem_tenantId_branchId_categoryId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "categoryId") REFERENCES "category" ("tenantId", "branchId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "navigationMenuItem" ADD CONSTRAINT "navigationMenuItem_tenantId_branchId_collectionId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "collectionId") REFERENCES "productCollection" ("tenantId", "branchId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "navigationMenuItem" ADD CONSTRAINT "navigationMenuItem_tenantId_branchId_pageId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "pageId") REFERENCES "shopPage" ("tenantId", "branchId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
