BEGIN;

CREATE TABLE "paymentMethod" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "label" VARCHAR(200) NOT NULL,
  "instructions" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "paymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shippingMethod" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "label" VARCHAR(200) NOT NULL,
  "fixedFee" DECIMAL(12,2) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "shippingMethod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shippingMethod_fixedFee_check" CHECK ("fixedFee" >= 0)
);

CREATE UNIQUE INDEX "paymentMethod_tenantId_branchId_id_key" ON "paymentMethod" ("tenantId", "branchId", "id");
CREATE INDEX "paymentMethod_tenantId_branchId_enabled_sortOrder_id_idx" ON "paymentMethod" ("tenantId", "branchId", "enabled", "sortOrder", "id");
CREATE UNIQUE INDEX "shippingMethod_tenantId_branchId_id_key" ON "shippingMethod" ("tenantId", "branchId", "id");
CREATE INDEX "shippingMethod_tenantId_branchId_enabled_sortOrder_id_idx" ON "shippingMethod" ("tenantId", "branchId", "enabled", "sortOrder", "id");

COMMIT;
