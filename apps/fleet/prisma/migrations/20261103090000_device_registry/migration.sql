BEGIN;

-- AlterTable
ALTER TABLE "device" ADD COLUMN     "edataModule" VARCHAR(64),
ADD COLUMN     "serialNumber" VARCHAR(32);

-- CreateIndex
CREATE UNIQUE INDEX "device_tenantId_branchId_serialNumber_key" ON "device"("tenantId", "branchId", "serialNumber");

-- Hand-written checks for the ERM label and eData module metadata.
ALTER TABLE "device" ADD CONSTRAINT "deviceSerialNumberCheck"
  CHECK ("serialNumber" IS NULL OR "serialNumber" ~ '^[0-9A-Za-z-]{1,32}$');

ALTER TABLE "device" ADD CONSTRAINT "deviceEdataModuleCheck"
  CHECK ("edataModule" IS NULL OR "edataModule" ~ '^[ -~]{1,64}$');

COMMIT;
