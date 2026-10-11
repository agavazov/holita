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
