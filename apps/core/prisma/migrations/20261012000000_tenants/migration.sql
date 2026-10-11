BEGIN;
CREATE TABLE "Tenant" (
  "id" UUID NOT NULL PRIMARY KEY,
  "name" VARCHAR(200) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");
INSERT INTO "Tenant" ("id", "name", "updatedAt") VALUES ('01000000-0000-4000-8000-000000000001', 'RentalSofia', CURRENT_TIMESTAMP);
ALTER TABLE "Store" RENAME TO "Store_before_tenants";
ALTER TABLE "Store_before_tenants" RENAME CONSTRAINT "Store_pkey" TO "Store_before_tenants_pkey";
CREATE TABLE "Store" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);


INSERT INTO "Store" ("id", "tenantId", "name", "createdAt", "updatedAt")
SELECT "id", '01000000-0000-4000-8000-000000000001'::uuid, "name", "createdAt", "updatedAt" FROM "Store_before_tenants";
DROP TABLE "Store_before_tenants";
CREATE UNIQUE INDEX "Store_tenantId_id_key" ON "Store"("tenantId", "id");
CREATE INDEX "Store_tenantId_name_id_idx" ON "Store"("tenantId", "name", "id");
ALTER TABLE "Store" ADD CONSTRAINT "Store_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;
