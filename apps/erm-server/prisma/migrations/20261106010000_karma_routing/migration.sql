CREATE TYPE "ermKarmaRoutingState" AS ENUM ('unknown', 'discocan', 'karmaBackup');
CREATE TYPE "ermKarmaReturnStatus" AS ENUM ('submitting', 'queued', 'uncertain', 'returned', 'needsOperator', 'failed');

CREATE TABLE "ermKarmaRouting" (
    "id" BIGSERIAL NOT NULL,
    "unitId" VARCHAR(15) NOT NULL,
    "state" "ermKarmaRoutingState" NOT NULL,
    "since" TIMESTAMPTZ(3),
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "latestKarmaReportAt" TIMESTAMPTZ(3),
    "parked" BOOLEAN,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "notificationKind" VARCHAR(64),
    CONSTRAINT "ermKarmaRouting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ermKarmaRouting_notificationKind_check" CHECK (
      "notificationKind" IS NULL
      OR ("notificationKind" = 'UNIT_ON_BACKUP' AND "state" = 'karmaBackup')
      OR ("notificationKind" = 'UNIT_RETURNED_TO_DISCOCAN' AND "state" = 'discocan')
    )
);

CREATE TABLE "ermKarmaReturnAttempt" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "unitId" VARCHAR(15) NOT NULL,
    "actorId" VARCHAR(128) NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "queueId" TEXT,
    "status" "ermKarmaReturnStatus" NOT NULL DEFAULT 'submitting',
    "pending" BOOLEAN NOT NULL DEFAULT true,
    "recoverySessionId" UUID,
    "discocanConnectionId" UUID,
    CONSTRAINT "ermKarmaReturnAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ermKarmaReturnAttempt_pending_check" CHECK (
      "pending" = ("status" IN ('submitting', 'queued', 'uncertain'))
    )
);

CREATE INDEX "ermKarmaRouting_unitId_id_idx" ON "ermKarmaRouting"("unitId", "id" DESC);
CREATE INDEX "ermKarmaReturnAttempt_tenantId_branchId_deviceId_requestedAt_idx" ON "ermKarmaReturnAttempt"("tenantId", "branchId", "deviceId", "requestedAt" DESC);
CREATE INDEX "ermKarmaReturnAttempt_unitId_requestedAt_idx" ON "ermKarmaReturnAttempt"("unitId", "requestedAt" DESC);
-- One outstanding return per physical unit, including an ambiguous Karma submission.
CREATE UNIQUE INDEX "ermKarmaReturnAttempt_pending_unit_key" ON "ermKarmaReturnAttempt"("unitId") WHERE "pending";

ALTER TABLE "ermKarmaReturnAttempt" ADD CONSTRAINT "ermKarmaReturnAttempt_recoverySessionId_fkey" FOREIGN KEY ("recoverySessionId") REFERENCES "ermRecoverySession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ermKarmaReturnAttempt" ADD CONSTRAINT "ermKarmaReturnAttempt_discocanConnectionId_fkey" FOREIGN KEY ("discocanConnectionId") REFERENCES "ermConnection"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
