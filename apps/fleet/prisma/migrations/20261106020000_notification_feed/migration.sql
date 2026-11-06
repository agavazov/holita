-- CreateEnum
CREATE TYPE "fleetNotificationSourceKind" AS ENUM ('fleetAlert', 'diagnostic', 'alarm', 'command');

-- CreateEnum
CREATE TYPE "fleetNotificationCategory" AS ENUM ('alert', 'device', 'command');

-- CreateTable
CREATE TABLE "fleetNotification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "sourceKind" "fleetNotificationSourceKind" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "category" "fleetNotificationCategory" NOT NULL,
    "severity" "fleetEventSeverity" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wordingKey" VARCHAR(100) NOT NULL,
    "parameters" JSONB NOT NULL,
    "vehicleId" UUID,
    "deviceId" UUID,
    "alertId" UUID,
    "ermEventId" TEXT,
    "commandRequestId" TEXT,

    CONSTRAINT "fleetNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleetNotificationReceipt" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "readAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fleetNotificationReceipt_pkey" PRIMARY KEY ("tenantId","branchId","notificationId","userId")
);

-- CreateTable
CREATE TABLE "fleetNotificationCursor" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "since" TIMESTAMPTZ(3) NOT NULL,
    "position" TEXT,

    CONSTRAINT "fleetNotificationCursor_pkey" PRIMARY KEY ("tenantId","branchId","sourceKey")
);

-- CreateIndex
CREATE INDEX "fleetNotification_tenantId_branchId_occurredAt_id_idx" ON "fleetNotification"("tenantId", "branchId", "occurredAt" DESC, "id");

-- CreateIndex
CREATE INDEX "fleetNotification_tenantId_branchId_createdAt_idx" ON "fleetNotification"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "fleetNotification_tenantId_branchId_id_key" ON "fleetNotification"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "fleetNotificationSourceKey" ON "fleetNotification"("tenantId", "branchId", "sourceKind", "sourceKey");

-- CreateIndex
CREATE INDEX "fleetNotificationReceipt_tenantId_branchId_userId_idx" ON "fleetNotificationReceipt"("tenantId", "branchId", "userId");

-- AddForeignKey
ALTER TABLE "fleetNotificationReceipt" ADD CONSTRAINT "fleetNotificationReceipt_tenantId_branchId_notificationId_fkey" FOREIGN KEY ("tenantId", "branchId", "notificationId") REFERENCES "fleetNotification"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- Structured wording parameters are always an object.
ALTER TABLE "fleetNotification" ADD CONSTRAINT "fleetNotificationParametersObject" CHECK (jsonb_typeof("parameters") = 'object');
