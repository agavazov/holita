CREATE TYPE "ermConfigurationChangeStatus" AS ENUM ('read', 'verified', 'mismatch', 'restored', 'restoreFailed', 'uncertain', 'refused', 'failed');

CREATE TABLE "ermConfigurationChange" (
    "id" UUID NOT NULL,
    "unitId" VARCHAR(15) NOT NULL,
    "parameter" INTEGER,
    "status" "ermConfigurationChangeStatus" NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "failureReason" TEXT,
    "baseline" JSONB NOT NULL,
    "intended" TEXT,
    "steps" JSONB NOT NULL,

    CONSTRAINT "ermConfigurationChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ermConfigurationChange_unitId_startedAt_idx" ON "ermConfigurationChange"("unitId", "startedAt" DESC);
