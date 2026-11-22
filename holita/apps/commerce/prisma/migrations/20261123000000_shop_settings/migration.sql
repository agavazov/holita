CREATE TABLE "shopSettings" (
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "displayName" VARCHAR(200),
  "contactEmail" VARCHAR(254),
  "contactPhone" VARCHAR(50),
  "contactAddress" VARCHAR(500),
  CONSTRAINT "shopSettings_pkey" PRIMARY KEY ("tenantId", "branchId")
);
