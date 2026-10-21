-- CreateEnum
CREATE TYPE "FleetDeviceOperationStatus" AS ENUM ('QUEUED', 'SUBMITTING', 'WAITING', 'COMPLETE', 'TIMED_OUT', 'FAILED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "FleetDeviceOperation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "deviceImei" VARCHAR(15) NOT NULL,
    "karmaCarId" VARCHAR(32) NOT NULL,
    "karmaDeviceId" VARCHAR(128) NOT NULL,
    "status" "FleetDeviceOperationStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "nextCheckAt" TIMESTAMPTZ(3) NOT NULL,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMPTZ(3),
    "queueIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "observations" JSONB NOT NULL DEFAULT '[]',
    "configuration" JSONB,
    "configurationId" VARCHAR(16),
    "errorCode" VARCHAR(64),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FleetDeviceOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FleetDeviceOperation_tenantId_branchId_deviceId_requestedAt_idx" ON "FleetDeviceOperation"("tenantId", "branchId", "deviceId", "requestedAt", "id");

-- CreateIndex
CREATE INDEX "FleetDeviceOperation_status_nextCheckAt_leaseUntil_idx" ON "FleetDeviceOperation"("status", "nextCheckAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "FleetDeviceOperation_tenantId_branchId_id_key" ON "FleetDeviceOperation"("tenantId", "branchId", "id");

-- AddForeignKey
ALTER TABLE "FleetDeviceOperation" ADD CONSTRAINT "FleetDeviceOperation_tenantId_branchId_deviceId_fkey" FOREIGN KEY ("tenantId", "branchId", "deviceId") REFERENCES "Device"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Device replies have no universal command correlation. Permit one active read per
-- configured Karma car, including an uncertain submission, across all workspaces.
CREATE UNIQUE INDEX "FleetDeviceOperation_active_karmaCarId_key"
ON "FleetDeviceOperation" ("karmaCarId")
WHERE "status" IN ('QUEUED', 'SUBMITTING', 'WAITING', 'UNKNOWN');

ALTER TABLE "FleetDeviceOperation"
  ADD CONSTRAINT "FleetDeviceOperation_identity_check" CHECK (
    "deviceImei" ~ '^[0-9]{15}$' AND "karmaCarId" ~ '^[1-9][0-9]{0,15}$'
    AND length("karmaDeviceId") > 0
  ),
  ADD CONSTRAINT "FleetDeviceOperation_lease_check" CHECK (
    ("leaseToken" IS NULL) = ("leaseUntil" IS NULL)
  ),
  ADD CONSTRAINT "FleetDeviceOperation_bounds_check" CHECK (
    "attempts" >= 0 AND "deadlineAt" > "requestedAt"
    AND cardinality("queueIds") <= 32
    AND jsonb_typeof("observations") IN ('array', 'object')
    AND ("configuration" IS NULL OR jsonb_typeof("configuration") = 'array')
  ),
  ADD CONSTRAINT "FleetDeviceOperation_complete_check" CHECK (
    "status" <> 'COMPLETE' OR (
      "configuration" IS NOT NULL AND "configurationId" IS NOT NULL
      AND "dispatchedAt" IS NOT NULL AND "completedAt" IS NOT NULL
    )
  );

