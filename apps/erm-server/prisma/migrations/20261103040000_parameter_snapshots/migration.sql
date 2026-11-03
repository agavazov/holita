CREATE TYPE "ermParameterSnapshotStatus" AS ENUM ('running', 'complete', 'failed');

CREATE TABLE "ermParameterSnapshot" (
    "id" UUID NOT NULL,
    "unitId" VARCHAR(15) NOT NULL,
    "status" "ermParameterSnapshotStatus" NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "parameterCount" INTEGER NOT NULL,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,

    CONSTRAINT "ermParameterSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ermParameterValue" (
    "snapshotId" UUID NOT NULL,
    "parameter" INTEGER NOT NULL,
    "value" TEXT,
    "resultCode" TEXT,

    CONSTRAINT "ermParameterValue_pkey" PRIMARY KEY ("snapshotId", "parameter")
);

CREATE INDEX "ermParameterSnapshot_unitId_startedAt_idx" ON "ermParameterSnapshot"("unitId", "startedAt" DESC);

ALTER TABLE "ermParameterValue" ADD CONSTRAINT "ermParameterValue_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ermParameterSnapshot"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
