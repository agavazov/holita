CREATE TYPE "ermDeviceAction" AS ENUM ('requestLocation', 'readStatus', 'readVersion', 'readAccessories', 'readEdataDiagnostics', 'readEdataFaults');
CREATE TYPE "ermCommandRequestStatus" AS ENUM ('queued', 'submitting', 'answered', 'failed', 'expired', 'cancelled', 'uncertain');

ALTER TABLE "ermConfigurationChange"
  ADD COLUMN "tenantId" UUID,
  ADD COLUMN "branchId" UUID,
  ADD COLUMN "deviceId" UUID,
  ADD COLUMN "actorId" VARCHAR(128),
  ADD COLUMN "intent" VARCHAR(200);
ALTER TABLE "ermParameterSnapshot"
  ADD COLUMN "tenantId" UUID,
  ADD COLUMN "branchId" UUID,
  ADD COLUMN "deviceId" UUID,
  ADD COLUMN "actorId" VARCHAR(128),
  ADD COLUMN "intent" VARCHAR(200);

CREATE INDEX "ermConfigurationChange_tenantId_branchId_deviceId_startedAt_idx"
  ON "ermConfigurationChange" ("tenantId", "branchId", "deviceId", "startedAt" DESC);
CREATE INDEX "ermParameterSnapshot_tenantId_branchId_deviceId_startedAt_idx"
  ON "ermParameterSnapshot" ("tenantId", "branchId", "deviceId", "startedAt" DESC);

CREATE TABLE "ermCommandRequest" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "unitId" VARCHAR(15) NOT NULL,
  "actorId" VARCHAR(128) NOT NULL,
  "intent" VARCHAR(200) NOT NULL,
  "action" "ermDeviceAction" NOT NULL,
  "status" "ermCommandRequestStatus" NOT NULL DEFAULT 'queued',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "submittedAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "commandId" UUID,
  "resultCode" TEXT,
  "responseText" TEXT,
  "failureReason" TEXT,
  CONSTRAINT "ermCommandRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ermCommandRequest_status_createdAt_idx" ON "ermCommandRequest" ("status", "createdAt");
CREATE INDEX "ermCommandRequest_tenantId_branchId_deviceId_createdAt_idx"
  ON "ermCommandRequest" ("tenantId", "branchId", "deviceId", "createdAt" DESC);
