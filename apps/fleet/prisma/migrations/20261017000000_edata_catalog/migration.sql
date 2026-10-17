-- CreateTable
CREATE TABLE "EdataCatalog" (
    "id" UUID NOT NULL,
    "sourceSha256" CHAR(64) NOT NULL,
    "extractorVersion" VARCHAR(32) NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "packageLabel" VARCHAR(64) NOT NULL,
    "contentSha256" CHAR(64) NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdataCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdataCatalogSource" (
    "catalogId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "evidence" JSONB NOT NULL,

    CONSTRAINT "EdataCatalogSource_pkey" PRIMARY KEY ("catalogId","key")
);

-- CreateTable
CREATE TABLE "EdataCatalogParameter" (
    "catalogId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "parameterId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "multiply" TEXT,
    "offset" TEXT,
    "details" JSONB NOT NULL,

    CONSTRAINT "EdataCatalogParameter_pkey" PRIMARY KEY ("catalogId","key")
);

-- CreateTable
CREATE TABLE "EdataCatalogSet" (
    "catalogId" UUID NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "details" JSONB NOT NULL,

    CONSTRAINT "EdataCatalogSet_pkey" PRIMARY KEY ("catalogId","vendorId")
);

-- CreateTable
CREATE TABLE "EdataCatalogSetMember" (
    "catalogId" UUID NOT NULL,
    "setId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "parameterId" INTEGER NOT NULL,

    CONSTRAINT "EdataCatalogSetMember_pkey" PRIMARY KEY ("catalogId","setId","position")
);

-- CreateTable
CREATE TABLE "EdataCatalogCategory" (
    "catalogId" UUID NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "EdataCatalogCategory_pkey" PRIMARY KEY ("catalogId","vendorId")
);

-- CreateTable
CREATE TABLE "EdataCatalogProfile" (
    "catalogId" UUID NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "setId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "EdataCatalogProfile_pkey" PRIMARY KEY ("catalogId","vendorId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EdataCatalog_sourceSha256_extractorVersion_schemaVersion_key" ON "EdataCatalog"("sourceSha256", "extractorVersion", "schemaVersion");

-- CreateIndex
CREATE INDEX "EdataCatalogParameter_catalogId_parameterId_category_idx" ON "EdataCatalogParameter"("catalogId", "parameterId", "category");

-- CreateIndex
CREATE INDEX "EdataCatalogSetMember_catalogId_parameterId_idx" ON "EdataCatalogSetMember"("catalogId", "parameterId");

-- AddForeignKey
ALTER TABLE "EdataCatalogSource" ADD CONSTRAINT "EdataCatalogSource_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "EdataCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdataCatalogParameter" ADD CONSTRAINT "EdataCatalogParameter_catalogId_sourceKey_fkey" FOREIGN KEY ("catalogId", "sourceKey") REFERENCES "EdataCatalogSource"("catalogId", "key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdataCatalogSet" ADD CONSTRAINT "EdataCatalogSet_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "EdataCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdataCatalogSetMember" ADD CONSTRAINT "EdataCatalogSetMember_catalogId_setId_fkey" FOREIGN KEY ("catalogId", "setId") REFERENCES "EdataCatalogSet"("catalogId", "vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdataCatalogCategory" ADD CONSTRAINT "EdataCatalogCategory_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "EdataCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdataCatalogProfile" ADD CONSTRAINT "EdataCatalogProfile_catalogId_setId_fkey" FOREIGN KEY ("catalogId", "setId") REFERENCES "EdataCatalogSet"("catalogId", "vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdataCatalogProfile" ADD CONSTRAINT "EdataCatalogProfile_catalogId_categoryId_fkey" FOREIGN KEY ("catalogId", "categoryId") REFERENCES "EdataCatalogCategory"("catalogId", "vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;

