BEGIN;

CREATE TYPE "karmaRecoveryAttemptStatus" AS ENUM ('submitting', 'accepted', 'uncertain', 'failed');

ALTER TABLE "karmaMonitoringTruck"
  ADD COLUMN "ignitionOffAt" TIMESTAMPTZ(3),
  ADD COLUMN "recoveryBlocked" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "karmaRecoveryAttempt" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "karmaCarId" VARCHAR(32) NOT NULL,
  "deviceImei" VARCHAR(15) NOT NULL,
  "status" "karmaRecoveryAttemptStatus" NOT NULL DEFAULT 'submitting',
  "requestedAt" TIMESTAMPTZ(3) NOT NULL,
  "completedAt" TIMESTAMPTZ(3),
  "ignitionOffAt" TIMESTAMPTZ(3) NOT NULL,
  "lastDataAt" TIMESTAMPTZ(3) NOT NULL,
  "queueIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "errorCode" VARCHAR(64),
  CONSTRAINT "karmaRecoveryAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "karmaRecoveryAttempt_imei_check" CHECK ("deviceImei" ~ '^[0-9]{15}$'),
  CONSTRAINT "karmaRecoveryAttempt_times_check" CHECK (
    "ignitionOffAt" <= "lastDataAt" AND "lastDataAt" <= "requestedAt"
    AND ("completedAt" IS NULL OR "completedAt" >= "requestedAt")
  ),
  CONSTRAINT "karmaRecoveryAttempt_tenantId_branchId_karmaCarId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "karmaCarId")
    REFERENCES "karmaMonitoringTruck" ("tenantId", "branchId", "karmaCarId")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX "karmaRecoveryAttempt_tenantId_branchId_deviceImei_requestedAt_idx"
  ON "karmaRecoveryAttempt" ("tenantId", "branchId", "deviceImei", "requestedAt" DESC);
CREATE INDEX "karmaRecoveryAttempt_tenantId_branchId_karmaCarId_requestedAt_idx"
  ON "karmaRecoveryAttempt" ("tenantId", "branchId", "karmaCarId", "requestedAt" DESC);

COMMIT;
