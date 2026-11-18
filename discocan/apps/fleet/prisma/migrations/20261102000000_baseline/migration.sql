-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "fleetDistanceUnit" AS ENUM ('km', 'mi');

-- CreateEnum
CREATE TYPE "fleetVolumeUnit" AS ENUM ('litre', 'usGallon');

-- CreateEnum
CREATE TYPE "fleetVehicleType" AS ENUM ('tractor', 'rigidTruck', 'van', 'car', 'trailer', 'other');

-- CreateEnum
CREATE TYPE "fleetFuelType" AS ENUM ('diesel', 'petrol', 'lpg', 'cng', 'electric', 'hybrid');

-- CreateEnum
CREATE TYPE "fleetVehicleStatus" AS ENUM ('active', 'inWorkshop', 'inactive');

-- CreateEnum
CREATE TYPE "fleetDeviceModel" AS ENUM ('starlinkTracker', 'starlinkScout', 'other');

-- CreateEnum
CREATE TYPE "fleetDeviceOperationStatus" AS ENUM ('queued', 'submitting', 'waiting', 'complete', 'timedOut', 'failed', 'unknown');

-- CreateEnum
CREATE TYPE "fleetDeviceOption" AS ENUM ('cellular4g', 'safetySf', 'irf', 'can', 'driverId', 'geozonesGo', 'temperatureDs', 'econnect', 'wifi', 'voice', 'externalAntenna', 'rs232', 'wiliot');

-- CreateEnum
CREATE TYPE "fleetDriverStatus" AS ENUM ('active', 'onLeave', 'inactive');

-- CreateEnum
CREATE TYPE "fleetLicenseCategory" AS ENUM ('b', 'be', 'c1', 'c1e', 'c', 'ce', 'd1', 'd1e', 'd', 'de');

-- CreateEnum
CREATE TYPE "fleetGroupColor" AS ENUM ('c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8');

-- CreateEnum
CREATE TYPE "fleetDataSource" AS ENUM ('demo', 'manual');

-- CreateEnum
CREATE TYPE "fleetEventKind" AS ENUM ('harshAcceleration', 'harshBraking', 'speedBump', 'overtaking', 'roundabout', 'laneChange', 'sharpTurn', 'offRoad', 'speeding', 'ignitionOn', 'ignitionOff', 'idling', 'lowFuel', 'fuelDrop', 'powerDisconnected', 'lowBackupBattery', 'canDisconnected', 'deviceOffline', 'diagnosticTroubleCode', 'crashDetected');

-- CreateEnum
CREATE TYPE "fleetEventSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "fleetAlertStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "fleetServiceType" AS ENUM ('generalService', 'oilChange', 'annualInspection', 'tachographCalibration', 'brakes', 'tires', 'repair', 'other');

-- CreateEnum
CREATE TYPE "fleetServiceStatus" AS ENUM ('planned', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "fleetDeviceOperationKind" AS ENUM ('readConfiguration', 'addParameter', 'updateInterval', 'readRules', 'upsertRule', 'readFaultLogger', 'readCommunicationDiagnostics');

-- CreateEnum
CREATE TYPE "fleetDeviceOperationPhase" AS ENUM ('readProfile', 'readParameters', 'writeParameter', 'verifyParameters', 'readRules', 'writeRule', 'verifyRules', 'readDiagnostics');

-- CreateTable
CREATE TABLE "fleetSettings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "timeZone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Sofia',
    "distanceUnit" "fleetDistanceUnit" NOT NULL DEFAULT 'km',
    "volumeUnit" "fleetVolumeUnit" NOT NULL DEFAULT 'litre',
    "lowFuelPct" INTEGER NOT NULL DEFAULT 12,
    "notReportingHours" INTEGER NOT NULL DEFAULT 48,
    "speedLimitKph" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fleetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "licensePlate" VARCHAR(32) NOT NULL,
    "notes" VARCHAR(2000),
    "fleetNumber" VARCHAR(16),
    "vehicleType" "fleetVehicleType",
    "make" VARCHAR(64),
    "model" VARCHAR(64),
    "modelYear" SMALLINT,
    "vin" VARCHAR(17),
    "fuelType" "fleetFuelType",
    "fuelTankCapacityL" SMALLINT,
    "status" "fleetVehicleStatus" NOT NULL DEFAULT 'active',
    "groupId" UUID,
    "currentDriverId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "imei" VARCHAR(15) NOT NULL,
    "vehicleId" UUID,
    "model" "fleetDeviceModel",
    "options" "fleetDeviceOption"[] DEFAULT ARRAY[]::"fleetDeviceOption"[],
    "firmwareVersion" VARCHAR(32),
    "simPhoneNumber" VARCHAR(20),
    "simIccid" VARCHAR(22),
    "installedAt" TIMESTAMPTZ(3),
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleetDeviceOperation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "deviceId" UUID,
    "deviceImei" VARCHAR(15),
    "karmaCarId" VARCHAR(32) NOT NULL,
    "karmaDeviceId" VARCHAR(128) NOT NULL,
    "status" "fleetDeviceOperationStatus" NOT NULL DEFAULT 'queued',
    "kind" "fleetDeviceOperationKind" NOT NULL DEFAULT 'readConfiguration',
    "phase" "fleetDeviceOperationPhase" NOT NULL DEFAULT 'readParameters',
    "baselineOperationId" UUID,
    "parameterBaselineOperationId" UUID,
    "ruleId" INTEGER,
    "ruleExpression" VARCHAR(4096),
    "ruleTrueEventId" INTEGER,
    "ruleFalseEventId" INTEGER,
    "ruleDebounceMilliseconds" INTEGER,
    "ruleDefinitionHex" VARCHAR(274),
    "baselineRules" JSONB,
    "rules" JSONB,
    "rulesConfigurationId" VARCHAR(16),
    "rulesReadAt" TIMESTAMPTZ(3),
    "rulesObservations" JSONB NOT NULL DEFAULT '[]',
    "rulesAfterMessageId" VARCHAR(16),
    "parameterId" INTEGER,
    "intervalSeconds" INTEGER,
    "previousIntervalSeconds" INTEGER,
    "catalogId" UUID,
    "profileId" INTEGER,
    "profileReadAt" TIMESTAMPTZ(3),
    "profileObservations" JSONB NOT NULL DEFAULT '[]',
    "baselineConfiguration" JSONB,
    "baselineConfigurationId" VARCHAR(16),
    "baselineObservations" JSONB NOT NULL DEFAULT '[]',
    "baselineReadAt" TIMESTAMPTZ(3),
    "definitionHex" VARCHAR(44),
    "readAfterMessageId" VARCHAR(16),
    "phaseDispatchedAt" TIMESTAMPTZ(3),
    "writeDispatchedAt" TIMESTAMPTZ(3),
    "writeQueueIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "writeUncertain" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "nextCheckAt" TIMESTAMPTZ(3) NOT NULL,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMPTZ(3),
    "queueIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "observations" JSONB NOT NULL DEFAULT '[]',
    "configuration" JSONB,
    "configurationId" VARCHAR(16),
    "errorCode" VARCHAR(64),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fleetDeviceOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver" (
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
    "licenseCategories" "fleetLicenseCategory"[] DEFAULT ARRAY[]::"fleetLicenseCategory"[],
    "licenseExpiresOn" DATE,
    "tachographCardNumber" VARCHAR(16),
    "tachographCardExpiresOn" DATE,
    "status" "fleetDriverStatus" NOT NULL DEFAULT 'active',
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicleGroup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" VARCHAR(500),
    "colorToken" "fleetGroupColor" NOT NULL DEFAULT 'c1',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicleStatusSample" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "deviceImei" VARCHAR(15),
    "source" "fleetDataSource" NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" VARCHAR(256),
    "speedKph" DOUBLE PRECISION,
    "headingDeg" SMALLINT,
    "ignition" BOOLEAN,
    "odometerKm" DOUBLE PRECISION,
    "fuelLevelPct" DOUBLE PRECISION,
    "externalVoltage" DOUBLE PRECISION,
    "backupBatteryVoltage" DOUBLE PRECISION,
    "engineHours" DOUBLE PRECISION,
    "coolantTempC" SMALLINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicleStatusSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "deviceImei" VARCHAR(15),
    "source" "fleetDataSource" NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "startAddress" VARCHAR(256),
    "endAddress" VARCHAR(256),
    "startLatitude" DOUBLE PRECISION,
    "startLongitude" DOUBLE PRECISION,
    "endLatitude" DOUBLE PRECISION,
    "endLongitude" DOUBLE PRECISION,
    "startOdometerKm" DOUBLE PRECISION,
    "endOdometerKm" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "idleSeconds" INTEGER,
    "maxSpeedKph" DOUBLE PRECISION,
    "fuelUsedL" DOUBLE PRECISION,
    "drivingScore" DOUBLE PRECISION,
    "ecoScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleetEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "tripId" UUID,
    "driverId" UUID,
    "deviceImei" VARCHAR(15),
    "source" "fleetDataSource" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "kind" "fleetEventKind" NOT NULL,
    "severity" "fleetEventSeverity" NOT NULL,
    "intensity" SMALLINT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" VARCHAR(256),
    "speedKph" DOUBLE PRECISION,
    "measuredValue" DOUBLE PRECISION,
    "thresholdValue" DOUBLE PRECISION,
    "troubleCode" VARCHAR(32),
    "details" VARCHAR(500),
    "alertStatus" "fleetAlertStatus",
    "acknowledgedAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),
    "remark" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fleetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serviceTask" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "serviceType" "fleetServiceType" NOT NULL,
    "status" "fleetServiceStatus" NOT NULL DEFAULT 'planned',
    "title" VARCHAR(120),
    "dueOn" DATE,
    "dueOdometerKm" INTEGER,
    "completedOn" DATE,
    "completedOdometerKm" INTEGER,
    "workshop" VARCHAR(128),
    "replacedParts" VARCHAR(1000),
    "costCents" INTEGER,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "serviceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edataCatalog" (
    "id" UUID NOT NULL,
    "sourceSha256" CHAR(64) NOT NULL,
    "extractorVersion" VARCHAR(32) NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "packageLabel" VARCHAR(64) NOT NULL,
    "contentSha256" CHAR(64) NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edataCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edataCatalogSource" (
    "catalogId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "evidence" JSONB NOT NULL,

    CONSTRAINT "edataCatalogSource_pkey" PRIMARY KEY ("catalogId","key")
);

-- CreateTable
CREATE TABLE "edataCatalogParameter" (
    "catalogId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "parameterId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "multiply" TEXT,
    "offset" TEXT,
    "details" JSONB NOT NULL,

    CONSTRAINT "edataCatalogParameter_pkey" PRIMARY KEY ("catalogId","key")
);

-- CreateTable
CREATE TABLE "edataCatalogSet" (
    "catalogId" UUID NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "details" JSONB NOT NULL,

    CONSTRAINT "edataCatalogSet_pkey" PRIMARY KEY ("catalogId","vendorId")
);

-- CreateTable
CREATE TABLE "edataCatalogSetMember" (
    "catalogId" UUID NOT NULL,
    "setId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "parameterId" INTEGER NOT NULL,

    CONSTRAINT "edataCatalogSetMember_pkey" PRIMARY KEY ("catalogId","setId","position")
);

-- CreateTable
CREATE TABLE "edataCatalogCategory" (
    "catalogId" UUID NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "edataCatalogCategory_pkey" PRIMARY KEY ("catalogId","vendorId")
);

-- CreateTable
CREATE TABLE "edataCatalogProfile" (
    "catalogId" UUID NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "setId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "edataCatalogProfile_pkey" PRIMARY KEY ("catalogId","vendorId")
);

-- CreateIndex
CREATE UNIQUE INDEX "fleetSettings_tenantId_branchId_key" ON "fleetSettings"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "vehicle_tenantId_branchId_createdAt_id_idx" ON "vehicle"("tenantId", "branchId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "vehicle_tenantId_branchId_groupId_idx" ON "vehicle"("tenantId", "branchId", "groupId");

-- CreateIndex
CREATE INDEX "vehicle_tenantId_branchId_currentDriverId_idx" ON "vehicle"("tenantId", "branchId", "currentDriverId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_tenantId_branchId_id_key" ON "vehicle"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_tenantId_branchId_fleetNumber_key" ON "vehicle"("tenantId", "branchId", "fleetNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_tenantId_branchId_vin_key" ON "vehicle"("tenantId", "branchId", "vin");

-- CreateIndex
CREATE INDEX "device_tenantId_branchId_createdAt_id_idx" ON "device"("tenantId", "branchId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "device_tenantId_branchId_vehicleId_idx" ON "device"("tenantId", "branchId", "vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "device_tenantId_branchId_id_key" ON "device"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tenantId_branchId_imei_key" ON "device"("tenantId", "branchId", "imei");

-- CreateIndex
CREATE INDEX "fleetDeviceOperation_tenantId_branchId_karmaCarId_karmaDevi_idx" ON "fleetDeviceOperation"("tenantId", "branchId", "karmaCarId", "karmaDeviceId", "requestedAt", "id");

-- CreateIndex
CREATE INDEX "fleetDeviceOperation_status_nextCheckAt_leaseUntil_idx" ON "fleetDeviceOperation"("status", "nextCheckAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "fleetDeviceOperation_tenantId_branchId_id_key" ON "fleetDeviceOperation"("tenantId", "branchId", "id");

-- CreateIndex
CREATE INDEX "driver_tenantId_branchId_lastName_firstName_id_idx" ON "driver"("tenantId", "branchId", "lastName", "firstName", "id");

-- CreateIndex
CREATE INDEX "driver_tenantId_branchId_createdAt_id_idx" ON "driver"("tenantId", "branchId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_tenantId_branchId_id_key" ON "driver"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_tenantId_branchId_employeeNumber_key" ON "driver"("tenantId", "branchId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "driver_tenantId_branchId_identificationKey_key" ON "driver"("tenantId", "branchId", "identificationKey");

-- CreateIndex
CREATE INDEX "vehicleGroup_tenantId_branchId_createdAt_id_idx" ON "vehicleGroup"("tenantId", "branchId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicleGroup_tenantId_branchId_id_key" ON "vehicleGroup"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicleGroup_tenantId_branchId_name_key" ON "vehicleGroup"("tenantId", "branchId", "name");

-- CreateIndex
CREATE INDEX "vehicleStatusSample_tenantId_branchId_vehicleId_recordedAt_idx" ON "vehicleStatusSample"("tenantId", "branchId", "vehicleId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "vehicleStatusSample_tenantId_branchId_recordedAt_idx" ON "vehicleStatusSample"("tenantId", "branchId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vehicleStatusSample_tenantId_branchId_vehicleId_deviceImei__key" ON "vehicleStatusSample"("tenantId", "branchId", "vehicleId", "deviceImei", "recordedAt");

-- CreateIndex
CREATE INDEX "trip_tenantId_branchId_startedAt_id_idx" ON "trip"("tenantId", "branchId", "startedAt" DESC, "id");

-- CreateIndex
CREATE INDEX "trip_tenantId_branchId_vehicleId_startedAt_idx" ON "trip"("tenantId", "branchId", "vehicleId", "startedAt");

-- CreateIndex
CREATE INDEX "trip_tenantId_branchId_driverId_startedAt_idx" ON "trip"("tenantId", "branchId", "driverId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "trip_tenantId_branchId_vehicleId_id_key" ON "trip"("tenantId", "branchId", "vehicleId", "id");

-- CreateIndex
CREATE INDEX "fleetEvent_tenantId_branchId_occurredAt_id_idx" ON "fleetEvent"("tenantId", "branchId", "occurredAt" DESC, "id");

-- CreateIndex
CREATE INDEX "fleetEvent_tenantId_branchId_alertStatus_occurredAt_id_idx" ON "fleetEvent"("tenantId", "branchId", "alertStatus", "occurredAt" DESC, "id");

-- CreateIndex
CREATE INDEX "fleetEvent_tenantId_branchId_vehicleId_occurredAt_idx" ON "fleetEvent"("tenantId", "branchId", "vehicleId", "occurredAt");

-- CreateIndex
CREATE INDEX "fleetEvent_tenantId_branchId_vehicleId_tripId_idx" ON "fleetEvent"("tenantId", "branchId", "vehicleId", "tripId");

-- CreateIndex
CREATE INDEX "fleetEvent_tenantId_branchId_driverId_occurredAt_idx" ON "fleetEvent"("tenantId", "branchId", "driverId", "occurredAt");

-- CreateIndex
CREATE INDEX "serviceTask_tenantId_branchId_status_dueOn_id_idx" ON "serviceTask"("tenantId", "branchId", "status", "dueOn", "id");

-- CreateIndex
CREATE INDEX "serviceTask_tenantId_branchId_vehicleId_status_idx" ON "serviceTask"("tenantId", "branchId", "vehicleId", "status");

-- CreateIndex
CREATE INDEX "serviceTask_tenantId_branchId_completedOn_idx" ON "serviceTask"("tenantId", "branchId", "completedOn");

-- CreateIndex
CREATE UNIQUE INDEX "edataCatalog_sourceSha256_extractorVersion_schemaVersion_key" ON "edataCatalog"("sourceSha256", "extractorVersion", "schemaVersion");

-- CreateIndex
CREATE INDEX "edataCatalogParameter_catalogId_parameterId_category_idx" ON "edataCatalogParameter"("catalogId", "parameterId", "category");

-- CreateIndex
CREATE INDEX "edataCatalogSetMember_catalogId_parameterId_idx" ON "edataCatalogSetMember"("catalogId", "parameterId");

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_tenantId_branchId_groupId_fkey" FOREIGN KEY ("tenantId", "branchId", "groupId") REFERENCES "vehicleGroup"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_tenantId_branchId_currentDriverId_fkey" FOREIGN KEY ("tenantId", "branchId", "currentDriverId") REFERENCES "driver"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "device" ADD CONSTRAINT "device_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "vehicle"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperation_tenantId_branchId_deviceId_fkey" FOREIGN KEY ("tenantId", "branchId", "deviceId") REFERENCES "device"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperation_tenantId_branchId_baselineOperationId_fkey" FOREIGN KEY ("tenantId", "branchId", "baselineOperationId") REFERENCES "fleetDeviceOperation"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperation_tenantId_branchId_parameterBaselineOp_fkey" FOREIGN KEY ("tenantId", "branchId", "parameterBaselineOperationId") REFERENCES "fleetDeviceOperation"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "vehicleStatusSample" ADD CONSTRAINT "vehicleStatusSample_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "vehicle"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "vehicle"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_tenantId_branchId_driverId_fkey" FOREIGN KEY ("tenantId", "branchId", "driverId") REFERENCES "driver"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEvent_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "vehicle"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEvent_tenantId_branchId_vehicleId_tripId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId", "tripId") REFERENCES "trip"("tenantId", "branchId", "vehicleId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEvent_tenantId_branchId_driverId_fkey" FOREIGN KEY ("tenantId", "branchId", "driverId") REFERENCES "driver"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "serviceTask" ADD CONSTRAINT "serviceTask_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "vehicle"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "edataCatalogSource" ADD CONSTRAINT "edataCatalogSource_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "edataCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edataCatalogParameter" ADD CONSTRAINT "edataCatalogParameter_catalogId_sourceKey_fkey" FOREIGN KEY ("catalogId", "sourceKey") REFERENCES "edataCatalogSource"("catalogId", "key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edataCatalogSet" ADD CONSTRAINT "edataCatalogSet_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "edataCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edataCatalogSetMember" ADD CONSTRAINT "edataCatalogSetMember_catalogId_setId_fkey" FOREIGN KEY ("catalogId", "setId") REFERENCES "edataCatalogSet"("catalogId", "vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edataCatalogCategory" ADD CONSTRAINT "edataCatalogCategory_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "edataCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edataCatalogProfile" ADD CONSTRAINT "edataCatalogProfile_catalogId_setId_fkey" FOREIGN KEY ("catalogId", "setId") REFERENCES "edataCatalogSet"("catalogId", "vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edataCatalogProfile" ADD CONSTRAINT "edataCatalogProfile_catalogId_categoryId_fkey" FOREIGN KEY ("catalogId", "categoryId") REFERENCES "edataCatalogCategory"("catalogId", "vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written CHECK constraints retained from the previous migration history.
ALTER TABLE "device" ADD CONSTRAINT "deviceImeiCheck" CHECK ("imei" ~ '^[0-9]{15}$');

ALTER TABLE "vehicle" ADD CONSTRAINT "vehicleModelYearCheck" CHECK ("modelYear" IS NULL OR "modelYear" BETWEEN 1950 AND 2100);

ALTER TABLE "vehicle" ADD CONSTRAINT "vehicleVinCheck" CHECK ("vin" IS NULL OR "vin" ~ '^[A-HJ-NPR-Z0-9]{17}$');

ALTER TABLE "vehicle" ADD CONSTRAINT "vehicleFuelTankCapacityLCheck" CHECK ("fuelTankCapacityL" IS NULL OR "fuelTankCapacityL" BETWEEN 1 AND 2000);

ALTER TABLE "vehicle" ADD CONSTRAINT "vehicleInactiveDriverCheck" CHECK ("status" <> 'inactive' OR "currentDriverId" IS NULL);

ALTER TABLE "device" ADD CONSTRAINT "deviceOptionsCheck" CHECK ("options" IS NOT NULL AND cardinality("options") <= 13);

ALTER TABLE "device" ADD CONSTRAINT "deviceSimPhoneNumberCheck" CHECK ("simPhoneNumber" IS NULL OR "simPhoneNumber" ~ '^\+?[0-9]{6,19}$');

ALTER TABLE "device" ADD CONSTRAINT "deviceSimIccidCheck" CHECK ("simIccid" IS NULL OR "simIccid" ~ '^[0-9]{18,22}$');

ALTER TABLE "driver" ADD CONSTRAINT "driverLicenseCategoriesCheck" CHECK ("licenseCategories" IS NOT NULL AND cardinality("licenseCategories") <= 10);

ALTER TABLE "driver" ADD CONSTRAINT "driverPhoneCheck" CHECK ("phone" IS NULL OR "phone" ~ '^\+?[0-9 ]{6,20}$');

ALTER TABLE "vehicleStatusSample" ADD CONSTRAINT "vehicleStatusSampleSourceCheck" CHECK (("source" = 'manual') = ("deviceImei" IS NULL));

ALTER TABLE "vehicleStatusSample" ADD CONSTRAINT "vehicleStatusSampleManualCheck" CHECK ("source" <> 'manual' OR (
    "odometerKm" IS NOT NULL AND "latitude" IS NULL AND "longitude" IS NULL AND "address" IS NULL
    AND "speedKph" IS NULL AND "headingDeg" IS NULL AND "ignition" IS NULL AND "fuelLevelPct" IS NULL
    AND "externalVoltage" IS NULL AND "backupBatteryVoltage" IS NULL AND "engineHours" IS NULL AND "coolantTempC" IS NULL));

ALTER TABLE "vehicleStatusSample" ADD CONSTRAINT "vehicleStatusSampleDeviceImeiCheck" CHECK ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$');

ALTER TABLE "vehicleStatusSample" ADD CONSTRAINT "vehicleStatusSamplePositionCheck" CHECK (
    ("latitude" IS NULL) = ("longitude" IS NULL)
    AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
    AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180));

ALTER TABLE "vehicleStatusSample" ADD CONSTRAINT "vehicleStatusSampleMeasureCheck" CHECK (
    ("speedKph" IS NULL OR "speedKph" BETWEEN 0 AND 400)
    AND ("headingDeg" IS NULL OR "headingDeg" BETWEEN 0 AND 359)
    AND ("odometerKm" IS NULL OR "odometerKm" BETWEEN 0 AND 10000000)
    AND ("fuelLevelPct" IS NULL OR "fuelLevelPct" BETWEEN 0 AND 100)
    AND ("externalVoltage" IS NULL OR "externalVoltage" BETWEEN 0 AND 60)
    AND ("backupBatteryVoltage" IS NULL OR "backupBatteryVoltage" BETWEEN 0 AND 10)
    AND ("engineHours" IS NULL OR "engineHours" BETWEEN 0 AND 1000000)
    AND ("coolantTempC" IS NULL OR "coolantTempC" BETWEEN -60 AND 200));

ALTER TABLE "trip" ADD CONSTRAINT "tripSourceCheck" CHECK ("source" <> 'manual');

ALTER TABLE "trip" ADD CONSTRAINT "tripDeviceImeiCheck" CHECK ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$');

ALTER TABLE "trip" ADD CONSTRAINT "tripPeriodCheck" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");

ALTER TABLE "trip" ADD CONSTRAINT "tripPositionCheck" CHECK (
    ("startLatitude" IS NULL) = ("startLongitude" IS NULL)
    AND ("startLatitude" IS NULL OR "startLatitude" BETWEEN -90 AND 90)
    AND ("startLongitude" IS NULL OR "startLongitude" BETWEEN -180 AND 180)
    AND ("endLatitude" IS NULL) = ("endLongitude" IS NULL)
    AND ("endLatitude" IS NULL OR "endLatitude" BETWEEN -90 AND 90)
    AND ("endLongitude" IS NULL OR "endLongitude" BETWEEN -180 AND 180));

ALTER TABLE "trip" ADD CONSTRAINT "tripMeasureCheck" CHECK (
    ("startOdometerKm" IS NULL OR "startOdometerKm" BETWEEN 0 AND 10000000)
    AND ("endOdometerKm" IS NULL OR "endOdometerKm" BETWEEN 0 AND 10000000)
    AND ("startOdometerKm" IS NULL OR "endOdometerKm" IS NULL OR "endOdometerKm" >= "startOdometerKm")
    AND ("distanceKm" IS NULL OR "distanceKm" BETWEEN 0 AND 5000)
    AND ("idleSeconds" IS NULL OR "idleSeconds" BETWEEN 0 AND 604800)
    AND ("maxSpeedKph" IS NULL OR "maxSpeedKph" BETWEEN 0 AND 400)
    AND ("fuelUsedL" IS NULL OR "fuelUsedL" BETWEEN 0 AND 5000)
    AND ("drivingScore" IS NULL OR "drivingScore" BETWEEN 0 AND 100)
    AND ("ecoScore" IS NULL OR "ecoScore" BETWEEN 0 AND 100));

ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEventSourceCheck" CHECK ("source" <> 'manual');

ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEventDeviceImeiCheck" CHECK ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$');

ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEventPositionCheck" CHECK (
    ("latitude" IS NULL) = ("longitude" IS NULL)
    AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
    AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180));

ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEventSpeedCheck" CHECK ("speedKph" IS NULL OR "speedKph" BETWEEN 0 AND 400);

ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEventIntensityCheck" CHECK ("intensity" IS NULL OR ("intensity" BETWEEN 1 AND 3 AND "kind" IN (
    'harshAcceleration', 'harshBraking', 'speedBump', 'overtaking', 'roundabout',
    'laneChange', 'sharpTurn', 'offRoad', 'speeding')));

ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEventAlertCheck" CHECK (
    ("alertStatus" IS NULL AND "acknowledgedAt" IS NULL AND "resolvedAt" IS NULL AND "remark" IS NULL)
    OR ("alertStatus" IS NOT NULL AND (
      ("alertStatus" = 'open' AND "acknowledgedAt" IS NULL AND "resolvedAt" IS NULL)
      OR ("alertStatus" = 'acknowledged' AND "acknowledgedAt" IS NOT NULL AND "resolvedAt" IS NULL)
      OR ("alertStatus" = 'resolved' AND "resolvedAt" IS NOT NULL))));

ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEventAlertSeverityCheck" CHECK ("alertStatus" IS NULL OR "severity" <> 'info');

ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEventAlertTimeCheck" CHECK (
    ("acknowledgedAt" IS NULL OR "acknowledgedAt" >= "occurredAt")
    AND ("resolvedAt" IS NULL OR "resolvedAt" >= "occurredAt")
    AND ("resolvedAt" IS NULL OR "acknowledgedAt" IS NULL OR "resolvedAt" >= "acknowledgedAt"));

ALTER TABLE "serviceTask" ADD CONSTRAINT "serviceTaskStatusCheck" CHECK (
    ("status" = 'planned' AND ("dueOn" IS NOT NULL OR "dueOdometerKm" IS NOT NULL)
      AND "completedOn" IS NULL AND "completedOdometerKm" IS NULL AND "costCents" IS NULL AND "replacedParts" IS NULL)
    OR ("status" = 'done' AND "completedOn" IS NOT NULL)
    OR ("status" = 'cancelled' AND "completedOn" IS NULL AND "completedOdometerKm" IS NULL AND "costCents" IS NULL));

ALTER TABLE "serviceTask" ADD CONSTRAINT "serviceTaskMeasureCheck" CHECK (
    ("dueOdometerKm" IS NULL OR "dueOdometerKm" BETWEEN 0 AND 10000000)
    AND ("completedOdometerKm" IS NULL OR "completedOdometerKm" BETWEEN 0 AND 10000000)
    AND ("costCents" IS NULL OR "costCents" BETWEEN 0 AND 100000000));

ALTER TABLE "fleetSettings" ADD CONSTRAINT "fleetSettingsTimeZoneCheck" CHECK ("timeZone" IN ('Europe/Sofia', 'Europe/Bucharest', 'Europe/Athens', 'Europe/Belgrade'));

ALTER TABLE "fleetSettings" ADD CONSTRAINT "fleetSettingsThresholdsCheck" CHECK ("lowFuelPct" BETWEEN 1 AND 50 AND "notReportingHours" BETWEEN 1 AND 168 AND "speedLimitKph" BETWEEN 30 AND 130);

ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperationLeaseCheck" CHECK (
    ("leaseToken" IS NULL) = ("leaseUntil" IS NULL)
  );

ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperationBoundsCheck" CHECK (
    "attempts" >= 0 AND "deadlineAt" > "requestedAt"
    AND cardinality("queueIds") <= 32
    AND jsonb_typeof("observations") IN ('array', 'object')
    AND ("configuration" IS NULL OR jsonb_typeof("configuration") = 'array')
  );

ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperationChangeBoundsCheck" CHECK (
    cardinality("writeQueueIds") <= 32
    AND ("previousIntervalSeconds" IS NULL OR "previousIntervalSeconds" BETWEEN 0 AND 65535)
    AND ("profileId" IS NULL OR "profileId" BETWEEN 0 AND 65535)
    AND ("definitionHex" IS NULL OR "definitionHex" ~ '^[0-9A-F]{44}$')
    AND ("readAfterMessageId" IS NULL OR "readAfterMessageId" ~ '^[1-9][0-9]{0,15}$')
    AND jsonb_typeof("profileObservations") IN ('array', 'object')
    AND jsonb_typeof("baselineObservations") IN ('array', 'object')
  );

ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperationRuleBoundsCheck" CHECK (
    ("ruleId" IS NULL OR "ruleId" BETWEEN 0 AND 65535)
    AND ("ruleTrueEventId" IS NULL OR "ruleTrueEventId" BETWEEN 0 AND 65535)
    AND ("ruleFalseEventId" IS NULL OR "ruleFalseEventId" BETWEEN 0 AND 65535)
    AND ("ruleDebounceMilliseconds" IS NULL OR "ruleDebounceMilliseconds" BETWEEN 1 AND 32767)
    AND ("ruleDefinitionHex" IS NULL OR (
      "ruleDefinitionHex" ~ '^[0-9A-F]+$'
      AND length("ruleDefinitionHex") BETWEEN 20 AND 274
      AND length("ruleDefinitionHex") % 2 = 0))
    AND ("rules" IS NULL OR jsonb_typeof("rules") = 'array')
    AND ("baselineRules" IS NULL OR jsonb_typeof("baselineRules") = 'array')
    AND jsonb_typeof("rulesObservations") IN ('array', 'object')
    AND ("rulesAfterMessageId" IS NULL OR "rulesAfterMessageId" ~ '^[1-9][0-9]{0,15}$')
  );

ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperationWriteMarkerCheck" CHECK (
    "writeDispatchedAt" IS NULL OR (
      "dispatchedAt" IS NOT NULL AND "baselineReadAt" IS NOT NULL AND (
        ("kind"::text IN ('addParameter', 'updateInterval')
          AND "phase"::text IN ('writeParameter', 'verifyParameters') AND "definitionHex" IS NOT NULL)
        OR ("kind"::text = 'upsertRule' AND "phase"::text IN ('writeRule', 'verifyRules')
          AND "rulesReadAt" IS NOT NULL AND "ruleDefinitionHex" IS NOT NULL)
      )
    )
  );

ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperationIdentityCheck" CHECK (
    ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$')
    AND "karmaCarId" ~ '^[1-9][0-9]{0,15}$'
    AND length("karmaDeviceId") > 0
  );

ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperationCompleteCheck" CHECK (
    "status" <> 'complete' OR (
      "dispatchedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND (
        ("kind"::text IN ('readRules', 'upsertRule')
          AND "rules" IS NOT NULL AND "rulesConfigurationId" IS NOT NULL)
        OR ("kind"::text IN ('readConfiguration', 'addParameter', 'updateInterval')
          AND "configuration" IS NOT NULL AND "configurationId" IS NOT NULL)
        OR ("kind"::text IN ('readFaultLogger', 'readCommunicationDiagnostics')
          AND jsonb_typeof("observations") = 'object'
          AND jsonb_typeof("observations"->'observations') = 'array'
          AND jsonb_array_length("observations"->'observations') > 0)
      )
    )
  );

ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperationChangeIntentCheck" CHECK (
    ("kind"::text = 'readConfiguration' AND "phase"::text = 'readParameters'
      AND "baselineOperationId" IS NULL AND "parameterId" IS NULL AND "intervalSeconds" IS NULL
      AND "writeDispatchedAt" IS NULL)
    OR ("kind"::text IN ('addParameter', 'updateInterval')
      AND "baselineOperationId" IS NOT NULL AND "baselineOperationId" <> "id"
      AND "parameterId" IS NOT NULL AND "parameterId" BETWEEN 0 AND 65535
      AND "intervalSeconds" IS NOT NULL AND "intervalSeconds" BETWEEN 0 AND 65000
      AND "baselineConfiguration" IS NOT NULL AND jsonb_typeof("baselineConfiguration") = 'array'
      AND "baselineConfigurationId" IS NOT NULL
      AND ("kind"::text <> 'addParameter' OR "catalogId" IS NOT NULL)
      AND ("kind"::text <> 'updateInterval' OR ("catalogId" IS NULL AND "phase"::text <> 'readProfile')))
    OR ("kind"::text = 'readRules' AND "phase"::text = 'readRules'
      AND "baselineOperationId" IS NULL AND "parameterBaselineOperationId" IS NULL
      AND "ruleId" IS NULL AND "writeDispatchedAt" IS NULL)
    OR ("kind"::text = 'upsertRule'
      AND "phase"::text IN ('readParameters', 'readRules', 'writeRule', 'verifyRules')
      AND "baselineOperationId" IS NOT NULL AND "baselineOperationId" <> "id"
      AND "parameterBaselineOperationId" IS NOT NULL AND "parameterBaselineOperationId" <> "id"
      AND "ruleId" IS NOT NULL AND "ruleExpression" IS NOT NULL
      AND "ruleTrueEventId" IS NOT NULL AND "ruleFalseEventId" IS NOT NULL
      AND "ruleDebounceMilliseconds" IS NOT NULL AND "ruleDefinitionHex" IS NOT NULL
      AND "baselineRules" IS NOT NULL AND jsonb_typeof("baselineRules") = 'array'
      AND "baselineConfiguration" IS NOT NULL AND jsonb_typeof("baselineConfiguration") = 'array'
      AND "baselineConfigurationId" IS NOT NULL)

    OR ("kind"::text IN ('readFaultLogger', 'readCommunicationDiagnostics')
      AND "phase"::text = 'readDiagnostics'
      AND "baselineOperationId" IS NULL AND "parameterBaselineOperationId" IS NULL
      AND "parameterId" IS NULL AND "ruleId" IS NULL AND "writeDispatchedAt" IS NULL)
  );

ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperationChangeCompleteCheck" CHECK (
    "kind"::text IN ('readConfiguration', 'readRules', 'readFaultLogger', 'readCommunicationDiagnostics')
    OR "status" <> 'complete'
    OR ("kind"::text IN ('addParameter', 'updateInterval')
      AND "phase"::text = 'verifyParameters' AND "writeDispatchedAt" IS NOT NULL)
    OR ("kind"::text = 'upsertRule' AND "phase"::text = 'verifyRules' AND "writeDispatchedAt" IS NOT NULL)
  );

-- Device replies have no universal correlation; serialize active operations per Karma car.
CREATE UNIQUE INDEX "fleetDeviceOperation_active_karmaCarId_key"
ON "fleetDeviceOperation" ("karmaCarId")
WHERE "status" IN ('queued', 'submitting', 'waiting', 'unknown');
