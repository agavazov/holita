-- Fleet master data: Vehicle/Device columns, Driver and VehicleGroup.
-- Generated with `prisma migrate diff` from apps/fleet; the CHECK constraints at the end are
-- hand-written (Prisma cannot express them). Existing rows receive the column defaults
-- (Vehicle.status ACTIVE, Device.options empty); no data is updated.
BEGIN;

-- CreateEnum
CREATE TYPE "FleetVehicleType" AS ENUM ('TRACTOR', 'RIGID_TRUCK', 'VAN', 'CAR', 'TRAILER', 'OTHER');

-- CreateEnum
CREATE TYPE "FleetFuelType" AS ENUM ('DIESEL', 'PETROL', 'LPG', 'CNG', 'ELECTRIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "FleetVehicleStatus" AS ENUM ('ACTIVE', 'IN_WORKSHOP', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FleetDeviceModel" AS ENUM ('STARLINK_TRACKER', 'STARLINK_SCOUT', 'OTHER');

-- CreateEnum
CREATE TYPE "FleetDeviceOption" AS ENUM ('CELLULAR_4G', 'SAFETY_SF', 'IRF', 'CAN', 'DRIVER_ID', 'GEOZONES_GO', 'TEMPERATURE_DS', 'ECONNECT', 'WIFI', 'VOICE', 'EXTERNAL_ANTENNA', 'RS232', 'WILIOT');

-- CreateEnum
CREATE TYPE "FleetDriverStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FleetLicenseCategory" AS ENUM ('B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE');

-- CreateEnum
CREATE TYPE "FleetGroupColor" AS ENUM ('C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "currentDriverId" UUID,
ADD COLUMN     "fleetNumber" VARCHAR(16),
ADD COLUMN     "fuelTankCapacityL" SMALLINT,
ADD COLUMN     "fuelType" "FleetFuelType",
ADD COLUMN     "groupId" UUID,
ADD COLUMN     "make" VARCHAR(64),
ADD COLUMN     "model" VARCHAR(64),
ADD COLUMN     "modelYear" SMALLINT,
ADD COLUMN     "status" "FleetVehicleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "vehicleType" "FleetVehicleType",
ADD COLUMN     "vin" VARCHAR(17);

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "firmwareVersion" VARCHAR(32),
ADD COLUMN     "installedAt" TIMESTAMPTZ(3),
ADD COLUMN     "model" "FleetDeviceModel",
ADD COLUMN     "notes" VARCHAR(2000),
ADD COLUMN     "options" "FleetDeviceOption"[] DEFAULT ARRAY[]::"FleetDeviceOption"[],
ADD COLUMN     "simIccid" VARCHAR(22),
ADD COLUMN     "simPhoneNumber" VARCHAR(20);

-- CreateTable
CREATE TABLE "Driver" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "firstName" VARCHAR(64) NOT NULL,
    "lastName" VARCHAR(64) NOT NULL,
    "employeeNumber" VARCHAR(32),
    "identificationKey" VARCHAR(32),
    "phone" VARCHAR(20),
    "email" VARCHAR(254),
    "licenseNumber" VARCHAR(32),
    "licenseCategories" "FleetLicenseCategory"[] DEFAULT ARRAY[]::"FleetLicenseCategory"[],
    "licenseExpiresOn" DATE,
    "tachographCardNumber" VARCHAR(16),
    "tachographCardExpiresOn" DATE,
    "status" "FleetDriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleGroup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" VARCHAR(500),
    "colorToken" "FleetGroupColor" NOT NULL DEFAULT 'C1',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VehicleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Driver_tenantId_branchId_lastName_firstName_id_idx" ON "Driver"("tenantId", "branchId", "lastName", "firstName", "id");

-- CreateIndex
CREATE INDEX "Driver_tenantId_branchId_createdAt_id_idx" ON "Driver"("tenantId", "branchId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_tenantId_branchId_id_key" ON "Driver"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_tenantId_branchId_employeeNumber_key" ON "Driver"("tenantId", "branchId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_tenantId_branchId_identificationKey_key" ON "Driver"("tenantId", "branchId", "identificationKey");

-- CreateIndex
CREATE INDEX "VehicleGroup_tenantId_branchId_createdAt_id_idx" ON "VehicleGroup"("tenantId", "branchId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleGroup_tenantId_branchId_id_key" ON "VehicleGroup"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleGroup_tenantId_branchId_name_key" ON "VehicleGroup"("tenantId", "branchId", "name");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_branchId_groupId_idx" ON "Vehicle"("tenantId", "branchId", "groupId");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_branchId_currentDriverId_idx" ON "Vehicle"("tenantId", "branchId", "currentDriverId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_tenantId_branchId_fleetNumber_key" ON "Vehicle"("tenantId", "branchId", "fleetNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_tenantId_branchId_vin_key" ON "Vehicle"("tenantId", "branchId", "vin");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tenantId_branchId_groupId_fkey" FOREIGN KEY ("tenantId", "branchId", "groupId") REFERENCES "VehicleGroup"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tenantId_branchId_currentDriverId_fkey" FOREIGN KEY ("tenantId", "branchId", "currentDriverId") REFERENCES "Driver"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Hand-written CHECK constraints. Enum arrays stay nullable columns (Prisma's shape) and are
-- required here, so later `migrate diff` runs stay clean.
ALTER TABLE "Vehicle"
  ADD CONSTRAINT "Vehicle_modelYear_check" CHECK ("modelYear" IS NULL OR "modelYear" BETWEEN 1950 AND 2100),
  ADD CONSTRAINT "Vehicle_vin_check" CHECK ("vin" IS NULL OR "vin" ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  ADD CONSTRAINT "Vehicle_fuelTankCapacityL_check" CHECK ("fuelTankCapacityL" IS NULL OR "fuelTankCapacityL" BETWEEN 1 AND 2000),
  ADD CONSTRAINT "Vehicle_inactive_driver_check" CHECK ("status" <> 'INACTIVE' OR "currentDriverId" IS NULL);
ALTER TABLE "Device"
  ADD CONSTRAINT "Device_options_check" CHECK ("options" IS NOT NULL AND cardinality("options") <= 13),
  ADD CONSTRAINT "Device_simPhoneNumber_check" CHECK ("simPhoneNumber" IS NULL OR "simPhoneNumber" ~ '^\+?[0-9]{6,19}$'),
  ADD CONSTRAINT "Device_simIccid_check" CHECK ("simIccid" IS NULL OR "simIccid" ~ '^[0-9]{18,22}$');
ALTER TABLE "Driver"
  ADD CONSTRAINT "Driver_licenseCategories_check" CHECK ("licenseCategories" IS NOT NULL AND cardinality("licenseCategories") <= 10),
  ADD CONSTRAINT "Driver_phone_check" CHECK ("phone" IS NULL OR "phone" ~ '^\+?[0-9 ]{6,20}$');

COMMIT;
