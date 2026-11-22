-- CreateEnum
CREATE TYPE "productBadgeColor" AS ENUM ('accent', 'neutral', 'info', 'success', 'warn', 'danger');

-- CreateTable
CREATE TABLE "productBadge" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "color" "productBadgeColor" NOT NULL DEFAULT 'accent',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "productBadge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "productBadge_sortOrder_check" CHECK ("sortOrder" >= 0)
);

-- CreateTable
CREATE TABLE "productBadgeAssignment" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "badgeId" UUID NOT NULL,

    CONSTRAINT "productBadgeAssignment_pkey" PRIMARY KEY ("tenantId", "branchId", "productId", "badgeId")
);

-- CreateTable
CREATE TABLE "productTag" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "slug" VARCHAR(200) NOT NULL,

    CONSTRAINT "productTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productTagAssignment" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "productTagAssignment_pkey" PRIMARY KEY ("tenantId", "branchId", "productId", "tagId")
);

-- CreateIndex
CREATE INDEX "productBadge_tenantId_branchId_sortOrder_name_id_idx" ON "productBadge"("tenantId", "branchId", "sortOrder", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "productBadge_tenantId_branchId_id_key" ON "productBadge"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "productBadge_tenantId_branchId_slug_key" ON "productBadge"("tenantId", "branchId", "slug");

-- CreateIndex
CREATE INDEX "productBadgeAssignment_tenantId_branchId_badgeId_idx" ON "productBadgeAssignment"("tenantId", "branchId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "productTag_tenantId_branchId_id_key" ON "productTag"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "productTag_tenantId_branchId_normalizedName_key" ON "productTag"("tenantId", "branchId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "productTag_tenantId_branchId_slug_key" ON "productTag"("tenantId", "branchId", "slug");

-- CreateIndex
CREATE INDEX "productTagAssignment_tenantId_branchId_tagId_idx" ON "productTagAssignment"("tenantId", "branchId", "tagId");

-- AddForeignKey
ALTER TABLE "productBadgeAssignment" ADD CONSTRAINT "productBadgeAssignment_tenantId_branchId_productId_fkey" FOREIGN KEY ("tenantId", "branchId", "productId") REFERENCES "product"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productBadgeAssignment" ADD CONSTRAINT "productBadgeAssignment_tenantId_branchId_badgeId_fkey" FOREIGN KEY ("tenantId", "branchId", "badgeId") REFERENCES "productBadge"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productTagAssignment" ADD CONSTRAINT "productTagAssignment_tenantId_branchId_productId_fkey" FOREIGN KEY ("tenantId", "branchId", "productId") REFERENCES "product"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productTagAssignment" ADD CONSTRAINT "productTagAssignment_tenantId_branchId_tagId_fkey" FOREIGN KEY ("tenantId", "branchId", "tagId") REFERENCES "productTag"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

