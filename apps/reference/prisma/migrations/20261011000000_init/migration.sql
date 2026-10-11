CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "licensePlate" VARCHAR(32) NOT NULL,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Vehicle_storeId_id_key" ON "Vehicle"("storeId", "id");
CREATE INDEX "Vehicle_storeId_createdAt_id_idx" ON "Vehicle"("storeId", "createdAt", "id");

CREATE TABLE "Device" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "imei" VARCHAR(15) NOT NULL,
  "vehicleId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Device_imei_check" CHECK ("imei" ~ '^[0-9]{15}$')
);
CREATE UNIQUE INDEX "Device_storeId_id_key" ON "Device"("storeId", "id");
CREATE UNIQUE INDEX "Device_storeId_imei_key" ON "Device"("storeId", "imei");
CREATE INDEX "Device_storeId_createdAt_id_idx" ON "Device"("storeId", "createdAt", "id");
CREATE INDEX "Device_storeId_vehicleId_idx" ON "Device"("storeId", "vehicleId");
ALTER TABLE "Device" ADD CONSTRAINT "Device_storeId_vehicleId_fkey"
  FOREIGN KEY ("storeId", "vehicleId") REFERENCES "Vehicle"("storeId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
