CREATE TYPE "ermRecoveryOutcome" AS ENUM ('alreadyDiscoCan', 'needsOperator');

CREATE TABLE "ermRecoverySession" (
    "id" UUID NOT NULL,
    "unitId" VARCHAR(15),
    "peer" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3) NOT NULL,
    "outcome" "ermRecoveryOutcome" NOT NULL,
    "reason" TEXT NOT NULL,
    "primaryHost" TEXT,
    "primaryPort" TEXT,

    CONSTRAINT "ermRecoverySession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ermRecoverySession_finishedAt_check" CHECK ("finishedAt" >= "startedAt")
);

CREATE INDEX "ermRecoverySession_unitId_startedAt_idx" ON "ermRecoverySession"("unitId", "startedAt" DESC);
