CREATE TYPE "productStatus" AS ENUM ('draft', 'active', 'archived');
CREATE TABLE "product" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "status" "productStatus" NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_tenantId_branchId_id_key" ON "product" ("tenantId", "branchId", "id");
CREATE INDEX "product_tenantId_branchId_name_id_idx" ON "product" ("tenantId", "branchId", "name", "id");
CREATE TABLE "customer" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_tenantId_branchId_id_key" ON "customer" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "customer_tenant_branch_email_key" ON "customer" ("tenantId", "branchId", lower("email"));
CREATE INDEX "customer_tenantId_branchId_name_id_idx" ON "customer" ("tenantId", "branchId", "name", "id");
