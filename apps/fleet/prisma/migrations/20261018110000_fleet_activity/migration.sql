-- Fleet activity: status samples, trips, events/alerts and service tasks.
-- Generated with `prisma migrate diff` from apps/fleet; the CHECK constraints at the end are
-- hand-written (Prisma cannot express them). Only new enums, tables, indexes and composite
-- foreign keys are created; no existing row changes.
BEGIN;

-- CreateEnum
CREATE TYPE "FleetDataSource" AS ENUM ('DEMO', 'MANUAL');

-- CreateEnum
CREATE TYPE "FleetEventKind" AS ENUM ('HARSH_ACCELERATION', 'HARSH_BRAKING', 'SPEED_BUMP', 'OVERTAKING', 'ROUNDABOUT', 'LANE_CHANGE', 'SHARP_TURN', 'OFF_ROAD', 'SPEEDING', 'IGNITION_ON', 'IGNITION_OFF', 'IDLING', 'LOW_FUEL', 'FUEL_DROP', 'POWER_DISCONNECTED', 'LOW_BACKUP_BATTERY', 'CAN_DISCONNECTED', 'DEVICE_OFFLINE', 'DIAGNOSTIC_TROUBLE_CODE', 'CRASH_DETECTED');

-- CreateEnum
CREATE TYPE "FleetEventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FleetAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "FleetServiceType" AS ENUM ('GENERAL_SERVICE', 'OIL_CHANGE', 'ANNUAL_INSPECTION', 'TACHOGRAPH_CALIBRATION', 'BRAKES', 'TIRES', 'REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "FleetServiceStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "VehicleStatusSample" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "deviceImei" VARCHAR(15),
    "source" "FleetDataSource" NOT NULL,
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

    CONSTRAINT "VehicleStatusSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "deviceImei" VARCHAR(15),
    "source" "FleetDataSource" NOT NULL,
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

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "tripId" UUID,
    "driverId" UUID,
    "deviceImei" VARCHAR(15),
    "source" "FleetDataSource" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "kind" "FleetEventKind" NOT NULL,
    "severity" "FleetEventSeverity" NOT NULL,
    "intensity" SMALLINT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" VARCHAR(256),
    "speedKph" DOUBLE PRECISION,
    "measuredValue" DOUBLE PRECISION,
    "thresholdValue" DOUBLE PRECISION,
    "troubleCode" VARCHAR(32),
    "details" VARCHAR(500),
    "alertStatus" "FleetAlertStatus",
    "acknowledgedAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),
    "remark" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FleetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTask" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "serviceType" "FleetServiceType" NOT NULL,
    "status" "FleetServiceStatus" NOT NULL DEFAULT 'PLANNED',
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

    CONSTRAINT "ServiceTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleStatusSample_tenantId_branchId_vehicleId_recordedAt_idx" ON "VehicleStatusSample"("tenantId", "branchId", "vehicleId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "VehicleStatusSample_tenantId_branchId_recordedAt_idx" ON "VehicleStatusSample"("tenantId", "branchId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleStatusSample_tenantId_branchId_vehicleId_deviceImei__key" ON "VehicleStatusSample"("tenantId", "branchId", "vehicleId", "deviceImei", "recordedAt");

-- CreateIndex
CREATE INDEX "Trip_tenantId_branchId_startedAt_id_idx" ON "Trip"("tenantId", "branchId", "startedAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Trip_tenantId_branchId_vehicleId_startedAt_idx" ON "Trip"("tenantId", "branchId", "vehicleId", "startedAt");

-- CreateIndex
CREATE INDEX "Trip_tenantId_branchId_driverId_startedAt_idx" ON "Trip"("tenantId", "branchId", "driverId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_tenantId_branchId_vehicleId_id_key" ON "Trip"("tenantId", "branchId", "vehicleId", "id");

-- CreateIndex
CREATE INDEX "FleetEvent_tenantId_branchId_occurredAt_id_idx" ON "FleetEvent"("tenantId", "branchId", "occurredAt" DESC, "id");

-- CreateIndex
CREATE INDEX "FleetEvent_tenantId_branchId_alertStatus_occurredAt_id_idx" ON "FleetEvent"("tenantId", "branchId", "alertStatus", "occurredAt" DESC, "id");

-- CreateIndex
CREATE INDEX "FleetEvent_tenantId_branchId_vehicleId_occurredAt_idx" ON "FleetEvent"("tenantId", "branchId", "vehicleId", "occurredAt");

-- CreateIndex
CREATE INDEX "FleetEvent_tenantId_branchId_vehicleId_tripId_idx" ON "FleetEvent"("tenantId", "branchId", "vehicleId", "tripId");

-- CreateIndex
CREATE INDEX "FleetEvent_tenantId_branchId_driverId_occurredAt_idx" ON "FleetEvent"("tenantId", "branchId", "driverId", "occurredAt");

-- CreateIndex
CREATE INDEX "ServiceTask_tenantId_branchId_status_dueOn_id_idx" ON "ServiceTask"("tenantId", "branchId", "status", "dueOn", "id");

-- CreateIndex
CREATE INDEX "ServiceTask_tenantId_branchId_vehicleId_status_idx" ON "ServiceTask"("tenantId", "branchId", "vehicleId", "status");

-- CreateIndex
CREATE INDEX "ServiceTask_tenantId_branchId_completedOn_idx" ON "ServiceTask"("tenantId", "branchId", "completedOn");

-- AddForeignKey
ALTER TABLE "VehicleStatusSample" ADD CONSTRAINT "VehicleStatusSample_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "Vehicle"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "Vehicle"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_tenantId_branchId_driverId_fkey" FOREIGN KEY ("tenantId", "branchId", "driverId") REFERENCES "Driver"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FleetEvent" ADD CONSTRAINT "FleetEvent_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "Vehicle"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FleetEvent" ADD CONSTRAINT "FleetEvent_tenantId_branchId_vehicleId_tripId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId", "tripId") REFERENCES "Trip"("tenantId", "branchId", "vehicleId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FleetEvent" ADD CONSTRAINT "FleetEvent_tenantId_branchId_driverId_fkey" FOREIGN KEY ("tenantId", "branchId", "driverId") REFERENCES "Driver"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ServiceTask" ADD CONSTRAINT "ServiceTask_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "Vehicle"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Hand-written CHECK constraints. Coordinates are both null or both set, latitude -90..90 and
-- longitude -180..180. Range checks also reject NaN and Infinity (PostgreSQL orders them above
-- every number).
ALTER TABLE "VehicleStatusSample"
  ADD CONSTRAINT "VehicleStatusSample_source_check" CHECK (("source" = 'MANUAL') = ("deviceImei" IS NULL)),
  ADD CONSTRAINT "VehicleStatusSample_manual_check" CHECK ("source" <> 'MANUAL' OR (
    "odometerKm" IS NOT NULL AND "latitude" IS NULL AND "longitude" IS NULL AND "address" IS NULL
    AND "speedKph" IS NULL AND "headingDeg" IS NULL AND "ignition" IS NULL AND "fuelLevelPct" IS NULL
    AND "externalVoltage" IS NULL AND "backupBatteryVoltage" IS NULL AND "engineHours" IS NULL AND "coolantTempC" IS NULL)),
  ADD CONSTRAINT "VehicleStatusSample_deviceImei_check" CHECK ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$'),
  ADD CONSTRAINT "VehicleStatusSample_position_check" CHECK (
    ("latitude" IS NULL) = ("longitude" IS NULL)
    AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
    AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)),
  ADD CONSTRAINT "VehicleStatusSample_measure_check" CHECK (
    ("speedKph" IS NULL OR "speedKph" BETWEEN 0 AND 400)
    AND ("headingDeg" IS NULL OR "headingDeg" BETWEEN 0 AND 359)
    AND ("odometerKm" IS NULL OR "odometerKm" BETWEEN 0 AND 10000000)
    AND ("fuelLevelPct" IS NULL OR "fuelLevelPct" BETWEEN 0 AND 100)
    AND ("externalVoltage" IS NULL OR "externalVoltage" BETWEEN 0 AND 60)
    AND ("backupBatteryVoltage" IS NULL OR "backupBatteryVoltage" BETWEEN 0 AND 10)
    AND ("engineHours" IS NULL OR "engineHours" BETWEEN 0 AND 1000000)
    AND ("coolantTempC" IS NULL OR "coolantTempC" BETWEEN -60 AND 200));
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_source_check" CHECK ("source" <> 'MANUAL'),
  ADD CONSTRAINT "Trip_deviceImei_check" CHECK ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$'),
  ADD CONSTRAINT "Trip_period_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt"),
  ADD CONSTRAINT "Trip_position_check" CHECK (
    ("startLatitude" IS NULL) = ("startLongitude" IS NULL)
    AND ("startLatitude" IS NULL OR "startLatitude" BETWEEN -90 AND 90)
    AND ("startLongitude" IS NULL OR "startLongitude" BETWEEN -180 AND 180)
    AND ("endLatitude" IS NULL) = ("endLongitude" IS NULL)
    AND ("endLatitude" IS NULL OR "endLatitude" BETWEEN -90 AND 90)
    AND ("endLongitude" IS NULL OR "endLongitude" BETWEEN -180 AND 180)),
  ADD CONSTRAINT "Trip_measure_check" CHECK (
    ("startOdometerKm" IS NULL OR "startOdometerKm" BETWEEN 0 AND 10000000)
    AND ("endOdometerKm" IS NULL OR "endOdometerKm" BETWEEN 0 AND 10000000)
    AND ("startOdometerKm" IS NULL OR "endOdometerKm" IS NULL OR "endOdometerKm" >= "startOdometerKm")
    AND ("distanceKm" IS NULL OR "distanceKm" BETWEEN 0 AND 5000)
    AND ("idleSeconds" IS NULL OR "idleSeconds" BETWEEN 0 AND 604800)
    AND ("maxSpeedKph" IS NULL OR "maxSpeedKph" BETWEEN 0 AND 400)
    AND ("fuelUsedL" IS NULL OR "fuelUsedL" BETWEEN 0 AND 5000)
    AND ("drivingScore" IS NULL OR "drivingScore" BETWEEN 0 AND 100)
    AND ("ecoScore" IS NULL OR "ecoScore" BETWEEN 0 AND 100));
ALTER TABLE "FleetEvent"
  ADD CONSTRAINT "FleetEvent_source_check" CHECK ("source" <> 'MANUAL'),
  ADD CONSTRAINT "FleetEvent_deviceImei_check" CHECK ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$'),
  ADD CONSTRAINT "FleetEvent_position_check" CHECK (
    ("latitude" IS NULL) = ("longitude" IS NULL)
    AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
    AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)),
  ADD CONSTRAINT "FleetEvent_speed_check" CHECK ("speedKph" IS NULL OR "speedKph" BETWEEN 0 AND 400),
  ADD CONSTRAINT "FleetEvent_intensity_check" CHECK ("intensity" IS NULL OR ("intensity" BETWEEN 1 AND 3 AND "kind" IN (
    'HARSH_ACCELERATION', 'HARSH_BRAKING', 'SPEED_BUMP', 'OVERTAKING', 'ROUNDABOUT',
    'LANE_CHANGE', 'SHARP_TURN', 'OFF_ROAD', 'SPEEDING'))),
  -- The status comparisons are guarded by IS NOT NULL: a NULL comparison would make the whole
  -- CHECK unknown, which PostgreSQL accepts, and let informational events carry alert fields.
  ADD CONSTRAINT "FleetEvent_alert_check" CHECK (
    ("alertStatus" IS NULL AND "acknowledgedAt" IS NULL AND "resolvedAt" IS NULL AND "remark" IS NULL)
    OR ("alertStatus" IS NOT NULL AND (
      ("alertStatus" = 'OPEN' AND "acknowledgedAt" IS NULL AND "resolvedAt" IS NULL)
      OR ("alertStatus" = 'ACKNOWLEDGED' AND "acknowledgedAt" IS NOT NULL AND "resolvedAt" IS NULL)
      OR ("alertStatus" = 'RESOLVED' AND "resolvedAt" IS NOT NULL)))),
  ADD CONSTRAINT "FleetEvent_alert_severity_check" CHECK ("alertStatus" IS NULL OR "severity" <> 'INFO'),
  ADD CONSTRAINT "FleetEvent_alert_time_check" CHECK (
    ("acknowledgedAt" IS NULL OR "acknowledgedAt" >= "occurredAt")
    AND ("resolvedAt" IS NULL OR "resolvedAt" >= "occurredAt")
    AND ("resolvedAt" IS NULL OR "acknowledgedAt" IS NULL OR "resolvedAt" >= "acknowledgedAt"));
ALTER TABLE "ServiceTask"
  ADD CONSTRAINT "ServiceTask_status_check" CHECK (
    ("status" = 'PLANNED' AND ("dueOn" IS NOT NULL OR "dueOdometerKm" IS NOT NULL)
      AND "completedOn" IS NULL AND "completedOdometerKm" IS NULL AND "costCents" IS NULL AND "replacedParts" IS NULL)
    OR ("status" = 'DONE' AND "completedOn" IS NOT NULL)
    OR ("status" = 'CANCELLED' AND "completedOn" IS NULL AND "completedOdometerKm" IS NULL AND "costCents" IS NULL)),
  ADD CONSTRAINT "ServiceTask_measure_check" CHECK (
    ("dueOdometerKm" IS NULL OR "dueOdometerKm" BETWEEN 0 AND 10000000)
    AND ("completedOdometerKm" IS NULL OR "completedOdometerKm" BETWEEN 0 AND 10000000)
    AND ("costCents" IS NULL OR "costCents" BETWEEN 0 AND 100000000));

COMMIT;
