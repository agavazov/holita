BEGIN;

ALTER TABLE "fleetEvent" ADD COLUMN "diagnosticFmi" SMALLINT,
ADD COLUMN "diagnosticIndex" INTEGER,
ADD COLUMN "diagnosticReport" SMALLINT,
ADD COLUMN "diagnosticSpn" BIGINT,
ADD COLUMN "diagnosticStatus" SMALLINT,
ADD COLUMN "receivedAt" TIMESTAMPTZ(3),
ADD COLUMN "sourceEventId" BIGINT;

ALTER TABLE "fleetEvent" ADD CONSTRAINT "fleetEventDiagnosticStatusCheck"
  CHECK ("diagnosticStatus" IN (1, 2));

-- Retain the legacy key for rows without a source event identity.
DROP INDEX "fleetEventErmKey";
CREATE UNIQUE INDEX "fleetEventErmKey" ON "fleetEvent"
  ("tenantId", "branchId", "vehicleId", "deviceImei", "occurredAt", "kind", "troubleCode")
  NULLS NOT DISTINCT WHERE "source" = 'erm' AND "sourceEventId" IS NULL;

-- The ordinal retains every fault, including identical codes or opposing statuses in one report.
CREATE UNIQUE INDEX "fleetEventErmReportKey" ON "fleetEvent"
  ("tenantId", "branchId", "vehicleId", "deviceImei", "sourceEventId", "diagnosticIndex")
  NULLS NOT DISTINCT WHERE "source" = 'erm' AND "sourceEventId" IS NOT NULL;

COMMIT;
