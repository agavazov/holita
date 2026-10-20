CREATE TYPE "FleetDistanceUnit" AS ENUM ('KM', 'MI');
CREATE TYPE "FleetVolumeUnit" AS ENUM ('LITRE', 'US_GALLON');

CREATE TABLE "FleetSettings" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "timeZone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Sofia',
  "distanceUnit" "FleetDistanceUnit" NOT NULL DEFAULT 'KM',
  "volumeUnit" "FleetVolumeUnit" NOT NULL DEFAULT 'LITRE',
  "lowFuelPct" INTEGER NOT NULL DEFAULT 12,
  "notReportingHours" INTEGER NOT NULL DEFAULT 48,
  "speedLimitKph" INTEGER NOT NULL DEFAULT 90,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "FleetSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FleetSettings_timeZone_check" CHECK ("timeZone" IN ('Europe/Sofia', 'Europe/Bucharest', 'Europe/Athens', 'Europe/Belgrade')),
  CONSTRAINT "FleetSettings_thresholds_check" CHECK ("lowFuelPct" BETWEEN 1 AND 50 AND "notReportingHours" BETWEEN 1 AND 168 AND "speedLimitKph" BETWEEN 30 AND 130)
);

CREATE UNIQUE INDEX "FleetSettings_tenantId_branchId_key" ON "FleetSettings"("tenantId", "branchId");
