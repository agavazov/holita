BEGIN;

-- Preserve device references and the last observed routing/backup history before removing the
-- transitional Karma Client persistence. A newer primary receipt supersedes the old observation.
ALTER TABLE "device"
  ADD COLUMN "karmaCarId" VARCHAR(32),
  ADD COLUMN "karmaDeviceId" VARCHAR(128),
  ADD COLUMN "routing" "fleetDeviceRouting",
  ADD COLUMN "routingObservedAt" TIMESTAMPTZ(3),
  ADD COLUMN "backupSince" TIMESTAMPTZ(3),
  ADD COLUMN "lastBackupStartedAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastBackupEndedAt" TIMESTAMPTZ(3),
  ADD COLUMN "backupSeconds" INTEGER NOT NULL DEFAULT 0;

UPDATE "device" AS d
SET "karmaCarId" = t."karmaCarId",
    "karmaDeviceId" = t."karmaDeviceId",
    "routing" = t."routing",
    "routingObservedAt" = t."updatedAt",
    "backupSince" = t."backupSince",
    "lastBackupStartedAt" = t."lastBackupStartedAt",
    "lastBackupEndedAt" = t."lastBackupEndedAt",
    "backupSeconds" = t."backupSeconds"
FROM (
  SELECT DISTINCT ON ("tenantId", "branchId", "karmaDeviceId")
    "tenantId", "branchId", "karmaCarId", "karmaDeviceId", "routing", "updatedAt",
    "backupSince", "lastBackupStartedAt", "lastBackupEndedAt", "backupSeconds"
  FROM "karmaMonitoringTruck"
  ORDER BY "tenantId", "branchId", "karmaDeviceId", "updatedAt" DESC, "id" DESC
) AS t
WHERE t."tenantId" = d."tenantId" AND t."branchId" = d."branchId"
  AND t."karmaDeviceId" = d."imei";

DROP TABLE "karmaMonitoringEvent";
DROP TABLE "karmaRecoveryAttempt";
DROP TABLE "karmaMonitoringTruck";
DROP TABLE "karmaMonitoringSettings";
DROP TABLE "fleetDeviceOperation";

DROP TYPE "karmaMonitoringEventKind";
DROP TYPE "karmaMonitoringSource";
DROP TYPE "karmaMonitoringCommandOutcome";
DROP TYPE "karmaRecoveryAttemptStatus";
DROP TYPE "fleetDeviceOperationStatus";
DROP TYPE "fleetDeviceOperationKind";
DROP TYPE "fleetDeviceOperationPhase";

COMMIT;
