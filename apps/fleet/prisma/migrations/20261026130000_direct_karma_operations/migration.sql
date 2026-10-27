-- Karma is the source of the car/device association. Existing operation audit metadata stays intact.
ALTER TABLE "Device" DROP CONSTRAINT "Device_karma_link_check";

-- DropIndex
DROP INDEX "Device_tenantId_branchId_karmaCarId_key";

-- DropIndex
DROP INDEX "Device_tenantId_branchId_karmaDeviceId_key";

-- DropIndex
DROP INDEX "FleetDeviceOperation_tenantId_branchId_deviceId_requestedAt_idx";

-- AlterTable
ALTER TABLE "Device" DROP COLUMN "karmaCarId",
DROP COLUMN "karmaDeviceId",
DROP COLUMN "karmaLinkedAt";

-- AlterTable
ALTER TABLE "FleetDeviceOperation" ALTER COLUMN "deviceId" DROP NOT NULL,
ALTER COLUMN "deviceImei" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FleetDeviceOperation_tenantId_branchId_karmaCarId_karmaDevi_idx" ON "FleetDeviceOperation"("tenantId", "branchId", "karmaCarId", "karmaDeviceId", "requestedAt", "id");

-- Legacy local metadata is optional; every operation still captures a valid Karma target.
ALTER TABLE "FleetDeviceOperation"
  DROP CONSTRAINT "FleetDeviceOperation_identity_check",
  ADD CONSTRAINT "FleetDeviceOperation_identity_check" CHECK (
    ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$')
    AND "karmaCarId" ~ '^[1-9][0-9]{0,15}$'
    AND length("karmaDeviceId") > 0
  );
