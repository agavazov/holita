BEGIN;

ALTER TABLE "karmaMonitoringTruck"
  ADD COLUMN "backupSince" TIMESTAMPTZ(3),
  ADD COLUMN "lastBackupStartedAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastBackupEndedAt" TIMESTAMPTZ(3),
  ADD COLUMN "backupSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "karmaMonitoringTruckBackupSecondsCheck" CHECK ("backupSeconds" >= 0),
  ADD CONSTRAINT "karmaMonitoringTruckBackupPeriodCheck" CHECK (
    ("lastBackupStartedAt" IS NULL) = ("lastBackupEndedAt" IS NULL)
    AND ("lastBackupStartedAt" IS NULL OR "lastBackupStartedAt" <= "lastBackupEndedAt")
  );

COMMIT;
