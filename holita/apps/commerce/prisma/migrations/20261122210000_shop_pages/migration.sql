CREATE TYPE "shopPageStatus" AS ENUM ('draft', 'published');

CREATE TABLE "shopPage" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "titleBg" VARCHAR(200),
  "titleEn" VARCHAR(200),
  "bodyBg" TEXT,
  "bodyEn" TEXT,
  "status" "shopPageStatus" NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "shopPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopPage_tenantId_branchId_id_key" ON "shopPage" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "shopPage_tenantId_branchId_slug_key" ON "shopPage" ("tenantId", "branchId", "slug");
CREATE INDEX "shopPage_tenantId_branchId_updatedAt_id_idx" ON "shopPage" ("tenantId", "branchId", "updatedAt" DESC, "id");
