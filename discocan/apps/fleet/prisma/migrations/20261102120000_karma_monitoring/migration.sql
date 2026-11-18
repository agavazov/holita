-- CreateEnum
CREATE TYPE "karmaMonitoringEventKind" AS ENUM ('cameOnline', 'noDataSince', 'faultReported', 'faultReadRequested', 'faultReadAnswered', 'faultReadFailed', 'pollFailed');

-- CreateEnum
CREATE TYPE "karmaMonitoringSource" AS ENUM ('statusPoll', 'karmaHistory', 'deviceCommand');

-- CreateEnum
CREATE TYPE "karmaMonitoringCommandOutcome" AS ENUM ('notAcknowledged', 'empty', 'faults', 'unresolved', 'failed');

-- AlterTable
ALTER TABLE "fleetDeviceOperation" ADD COLUMN     "monitoringOrigin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "karmaMonitoringSettings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "statusPollSeconds" INTEGER NOT NULL DEFAULT 60,
    "offlineAfterMinutes" INTEGER NOT NULL DEFAULT 15,
    "faultHistoryPollMinutes" INTEGER NOT NULL DEFAULT 60,
    "faultCommandEnabled" BOOLEAN NOT NULL DEFAULT true,
    "faultCommandMinutes" INTEGER NOT NULL DEFAULT 60,
    "retentionDays" INTEGER NOT NULL DEFAULT 10,
    "lastStatusPollAt" TIMESTAMPTZ(3),
    "lastRetentionAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "karmaMonitoringSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karmaMonitoringTruck" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "karmaCarId" VARCHAR(32) NOT NULL,
    "karmaDeviceId" VARCHAR(128) NOT NULL,
    "displayName" VARCHAR(256) NOT NULL,
    "lastDataAt" TIMESTAMPTZ(3),
    "online" BOOLEAN NOT NULL DEFAULT false,
    "onlineSince" TIMESTAMPTZ(3),
    "noDataSince" TIMESTAMPTZ(3),
    "historyCursor" VARCHAR(32) NOT NULL DEFAULT '0',
    "historyBeforeId" VARCHAR(32),
    "historyHighWatermark" VARCHAR(32),
    "lastHistoryPollAt" TIMESTAMPTZ(3),
    "lastCommandOperationId" UUID,
    "lastCommandRequestedAt" TIMESTAMPTZ(3),
    "lastCommandCompletedAt" TIMESTAMPTZ(3),
    "lastCommandOutcome" "karmaMonitoringCommandOutcome",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "karmaMonitoringTruck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karmaMonitoringEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "karmaCarId" VARCHAR(32),
    "kind" "karmaMonitoringEventKind" NOT NULL,
    "source" "karmaMonitoringSource" NOT NULL,
    "sourceKey" VARCHAR(256) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" VARCHAR(32),
    "spn" DOUBLE PRECISION,
    "fmi" INTEGER,
    "faultStatus" VARCHAR(32),
    "commandOutcome" "karmaMonitoringCommandOutcome",
    "operationId" UUID,
    "rawRecord" JSONB,
    "details" VARCHAR(256),

    CONSTRAINT "karmaMonitoringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "karmaMonitoringSettings_tenantId_branchId_key" ON "karmaMonitoringSettings"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "karmaMonitoringTruck_tenantId_branchId_displayName_id_idx" ON "karmaMonitoringTruck"("tenantId", "branchId", "displayName", "id");

-- CreateIndex
CREATE UNIQUE INDEX "karmaMonitoringTruck_tenantId_branchId_karmaCarId_key" ON "karmaMonitoringTruck"("tenantId", "branchId", "karmaCarId");

-- CreateIndex
CREATE INDEX "karmaMonitoringEvent_tenantId_branchId_occurredAt_id_idx" ON "karmaMonitoringEvent"("tenantId", "branchId", "occurredAt" DESC, "id");

-- CreateIndex
CREATE INDEX "karmaMonitoringEvent_tenantId_branchId_karmaCarId_kind_occu_idx" ON "karmaMonitoringEvent"("tenantId", "branchId", "karmaCarId", "kind", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "karmaMonitoringEvent_tenantId_branchId_source_sourceKey_key" ON "karmaMonitoringEvent"("tenantId", "branchId", "source", "sourceKey");

-- AddForeignKey
ALTER TABLE "karmaMonitoringEvent" ADD CONSTRAINT "karmaMonitoringEvent_tenantId_branchId_karmaCarId_fkey" FOREIGN KEY ("tenantId", "branchId", "karmaCarId") REFERENCES "karmaMonitoringTruck"("tenantId", "branchId", "karmaCarId") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Settings are also protected when edited directly in the Karma settings table.
ALTER TABLE "karmaMonitoringSettings" ADD CONSTRAINT "karmaMonitoringSettingsRangesCheck" CHECK (
  "statusPollSeconds" BETWEEN 30 AND 3600 AND
  "offlineAfterMinutes" BETWEEN 2 AND 1440 AND
  "faultHistoryPollMinutes" BETWEEN 5 AND 1440 AND
  "faultCommandMinutes" BETWEEN 15 AND 1440 AND
  "retentionDays" BETWEEN 1 AND 30
);

-- Monitoring can only originate the fixed read-only fault logger operation.
ALTER TABLE "fleetDeviceOperation" ADD CONSTRAINT "fleetDeviceOperationMonitoringReadCheck"
  CHECK (NOT "monitoringOrigin" OR "kind" = 'readFaultLogger');
