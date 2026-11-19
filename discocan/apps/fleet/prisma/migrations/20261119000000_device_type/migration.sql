BEGIN;

-- CreateEnum
CREATE TYPE "fleetDeviceType" AS ENUM ('discocan', 'erm');

-- AlterEnum
ALTER TYPE "fleetDataSource" ADD VALUE 'discocan';

-- Classify the existing registry before setting the default for new devices.
ALTER TABLE "device" ADD COLUMN "type" "fleetDeviceType" NOT NULL DEFAULT 'erm';
ALTER TABLE "device" ALTER COLUMN "type" SET DEFAULT 'discocan';

-- CreateTable
CREATE TABLE "ermDevice" (
    "deviceId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "edataModule" VARCHAR(64),
    "karmaCarId" VARCHAR(32),
    "karmaDeviceId" VARCHAR(128),
    "routing" "fleetDeviceRouting",
    "routingObservedAt" TIMESTAMPTZ(3),
    "backupSince" TIMESTAMPTZ(3),
    "lastBackupStartedAt" TIMESTAMPTZ(3),
    "lastBackupEndedAt" TIMESTAMPTZ(3),
    "backupSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ermDevice_pkey" PRIMARY KEY ("deviceId"),
    CONSTRAINT "ermDeviceEdataModuleCheck"
        CHECK ("edataModule" IS NULL OR "edataModule" ~ '^[ -~]{1,64}$')
);

CREATE UNIQUE INDEX "ermDevice_tenantId_branchId_deviceId_key" ON "ermDevice"("tenantId", "branchId", "deviceId");
ALTER TABLE "ermDevice" ADD CONSTRAINT "ermDevice_tenantId_branchId_deviceId_fkey" FOREIGN KEY ("tenantId", "branchId", "deviceId") REFERENCES "device"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- Copy the complete ERM record for every existing device before dropping its old columns.
INSERT INTO "ermDevice" (
    "deviceId", "tenantId", "branchId", "edataModule", "karmaCarId", "karmaDeviceId",
    "routing", "routingObservedAt", "backupSince", "lastBackupStartedAt", "lastBackupEndedAt",
    "backupSeconds"
)
SELECT "id", "tenantId", "branchId", "edataModule", "karmaCarId", "karmaDeviceId",
    "routing", "routingObservedAt", "backupSince", "lastBackupStartedAt", "lastBackupEndedAt",
    "backupSeconds"
FROM "device";

ALTER TABLE "device"
    DROP COLUMN "backupSeconds",
    DROP COLUMN "backupSince",
    DROP COLUMN "edataModule",
    DROP COLUMN "karmaCarId",
    DROP COLUMN "karmaDeviceId",
    DROP COLUMN "lastBackupEndedAt",
    DROP COLUMN "lastBackupStartedAt",
    DROP COLUMN "routing",
    DROP COLUMN "routingObservedAt";

-- Keep the existing adapter position and all of its constraints.
ALTER TABLE "fleetErmCursor" RENAME TO "deviceCursor";
ALTER TABLE "deviceCursor" RENAME CONSTRAINT "fleetErmCursor_pkey" TO "deviceCursor_pkey";
ALTER TABLE "deviceCursor" RENAME CONSTRAINT "fleetErmCursorLastEventIdCheck" TO "deviceCursorLastEventIdCheck";
ALTER TABLE "deviceCursor" RENAME CONSTRAINT "fleetErmCursor_tenantId_branchId_deviceId_fkey" TO "deviceCursor_tenantId_branchId_deviceId_fkey";
ALTER INDEX "fleetErmCursor_tenantId_branchId_deviceId_key" RENAME TO "deviceCursor_tenantId_branchId_deviceId_key";

COMMIT;
