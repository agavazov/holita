BEGIN;

-- AlterEnum
ALTER TYPE "fleetEventKind" ADD VALUE 'canError';

-- CreateIndex
CREATE UNIQUE INDEX "fleetEventErmKey" ON "fleetEvent" ("tenantId", "branchId", "vehicleId", "deviceImei", "occurredAt", "kind", "troubleCode") NULLS NOT DISTINCT WHERE "source" = 'erm';

COMMIT;
