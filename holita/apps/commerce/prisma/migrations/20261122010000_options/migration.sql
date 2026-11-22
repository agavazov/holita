CREATE TABLE "option" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "showInFilters" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "option_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "optionValue" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "optionId" UUID NOT NULL,
  "label" VARCHAR(200) NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "optionValue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "optionValue_sortOrder_check" CHECK ("sortOrder" >= 0)
);

CREATE UNIQUE INDEX "option_tenantId_branchId_id_key" ON "option" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "option_tenantId_branchId_name_key" ON "option" ("tenantId", "branchId", "name");
CREATE INDEX "optionValue_tenantId_branchId_optionId_sortOrder_idx" ON "optionValue" ("tenantId", "branchId", "optionId", "sortOrder");
ALTER TABLE "optionValue" ADD CONSTRAINT "optionValue_tenantId_branchId_optionId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "optionId") REFERENCES "option" ("tenantId", "branchId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
