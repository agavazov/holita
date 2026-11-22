CREATE TYPE "blogArticleStatus" AS ENUM ('draft', 'published');

CREATE TABLE "blogArticle" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "titleBg" VARCHAR(200),
  "titleEn" VARCHAR(200),
  "bodyBg" TEXT,
  "bodyEn" TEXT,
  "status" "blogArticleStatus" NOT NULL DEFAULT 'draft',
  "publishedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "blogArticle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "blogArticle_publishedAt_matches_status_check"
    CHECK (("status" = 'published') = ("publishedAt" IS NOT NULL))
);

CREATE TABLE "blogTag" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "blogTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blogArticleTag" (
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "articleId" UUID NOT NULL,
  "tagId" UUID NOT NULL,
  CONSTRAINT "blogArticleTag_pkey" PRIMARY KEY ("tenantId", "branchId", "articleId", "tagId")
);

CREATE INDEX "blogArticle_tenantId_branchId_status_publishedAt_id_idx" ON "blogArticle" ("tenantId", "branchId", "status", "publishedAt" DESC, "id");

CREATE UNIQUE INDEX "blogArticle_tenantId_branchId_id_key" ON "blogArticle" ("tenantId", "branchId", "id");

CREATE UNIQUE INDEX "blogArticle_tenantId_branchId_slug_key" ON "blogArticle" ("tenantId", "branchId", "slug");

CREATE UNIQUE INDEX "blogTag_tenantId_branchId_id_key" ON "blogTag" ("tenantId", "branchId", "id");

CREATE UNIQUE INDEX "blogTag_tenantId_branchId_normalizedName_key" ON "blogTag" ("tenantId", "branchId", "normalizedName");

CREATE UNIQUE INDEX "blogTag_tenantId_branchId_slug_key" ON "blogTag" ("tenantId", "branchId", "slug");

CREATE INDEX "blogArticleTag_tenantId_branchId_tagId_idx" ON "blogArticleTag" ("tenantId", "branchId", "tagId");

ALTER TABLE "blogArticleTag" ADD CONSTRAINT "blogArticleTag_tenantId_branchId_articleId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "articleId") REFERENCES "blogArticle" ("tenantId", "branchId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blogArticleTag" ADD CONSTRAINT "blogArticleTag_tenantId_branchId_tagId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "tagId") REFERENCES "blogTag" ("tenantId", "branchId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
