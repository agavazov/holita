BEGIN;
ALTER TABLE "Device" DROP CONSTRAINT "Device_storeId_vehicleId_fkey";
ALTER TABLE "Device" RENAME TO "Device_before_tenants";
ALTER TABLE "Vehicle" RENAME TO "Vehicle_before_tenants";
ALTER TABLE "Device_before_tenants" RENAME CONSTRAINT "Device_pkey" TO "Device_before_tenants_pkey";
ALTER TABLE "Vehicle_before_tenants" RENAME CONSTRAINT "Vehicle_pkey" TO "Vehicle_before_tenants_pkey";
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "licensePlate" VARCHAR(32) NOT NULL,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Vehicle_tenantId_storeId_id_key" ON "Vehicle"("tenantId", "storeId", "id");
CREATE INDEX "Vehicle_tenantId_storeId_createdAt_id_idx" ON "Vehicle"("tenantId", "storeId", "createdAt", "id");

CREATE TABLE "Device" (
  "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "imei" VARCHAR(15) NOT NULL,
  "vehicleId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Device_imei_check" CHECK ("imei" ~ '^[0-9]{15}$')
);
CREATE UNIQUE INDEX "Device_tenantId_storeId_id_key" ON "Device"("tenantId", "storeId", "id");
CREATE UNIQUE INDEX "Device_tenantId_storeId_imei_key" ON "Device"("tenantId", "storeId", "imei");
CREATE INDEX "Device_tenantId_storeId_createdAt_id_idx" ON "Device"("tenantId", "storeId", "createdAt", "id");
CREATE INDEX "Device_tenantId_storeId_vehicleId_idx" ON "Device"("tenantId", "storeId", "vehicleId");
ALTER TABLE "Device" ADD CONSTRAINT "Device_tenantId_storeId_vehicleId_fkey"
  FOREIGN KEY ("tenantId", "storeId", "vehicleId") REFERENCES "Vehicle"("tenantId", "storeId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

INSERT INTO "Vehicle" ("id", "tenantId", "storeId", "licensePlate", "notes", "createdAt", "updatedAt")
SELECT "id", '01000000-0000-4000-8000-000000000001'::uuid, "storeId", "licensePlate", "notes", "createdAt", "updatedAt" FROM "Vehicle_before_tenants";
INSERT INTO "Device" ("id", "tenantId", "storeId", "imei", "vehicleId", "createdAt", "updatedAt")
SELECT "id", '01000000-0000-4000-8000-000000000001'::uuid, "storeId", "imei", "vehicleId", "createdAt", "updatedAt" FROM "Device_before_tenants";
DROP TABLE "Device_before_tenants";
DROP TABLE "Vehicle_before_tenants";
COMMIT;
