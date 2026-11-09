BEGIN;

-- AlterEnum
ALTER TYPE "fleetEventKind" ADD VALUE 'unitOnBackup';

-- CreateEnum
CREATE TYPE "fleetDeviceRouting" AS ENUM ('holita', 'karmaBackup', 'silent');

-- AlterTable
ALTER TABLE "karmaMonitoringTruck"
    ADD COLUMN "routing" "fleetDeviceRouting",
    ADD COLUMN "routingAheadPolls" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "routingAheadSince" TIMESTAMPTZ(3),
    ADD CONSTRAINT "karmaMonitoringTruckRoutingAheadPollsCheck" CHECK ("routingAheadPolls" >= 0);

-- AlterTable
ALTER TABLE "fleetErmCursor" ADD COLUMN "lastReceivedAt" TIMESTAMPTZ(3);

-- Backfill imported ERM receipt times through each cursor's scoped Device and IMEI.
UPDATE "fleetErmCursor" AS c
SET "lastReceivedAt" = (
    SELECT MAX(s."receivedAt")
    FROM "device" AS d
    JOIN "vehicleStatusSample" AS s
      ON s."tenantId" = d."tenantId"
     AND s."branchId" = d."branchId"
     AND s."deviceImei" = d."imei"
     AND s."source" = 'erm'
    WHERE d."id" = c."deviceId"
      AND d."tenantId" = c."tenantId"
      AND d."branchId" = c."branchId"
);

COMMIT;
