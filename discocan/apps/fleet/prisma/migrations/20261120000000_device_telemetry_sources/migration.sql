BEGIN;

ALTER TABLE "vehicleEdataMeasurement"
  DROP CONSTRAINT "vehicleEdataMeasurement_source_check",
  ADD CONSTRAINT "vehicleEdataMeasurement_source_check"
    CHECK ("source" IN ('erm', 'discocan') AND "sourceEventId" > 0);

DROP INDEX "vehicleEdataMeasurementErmKey";
CREATE UNIQUE INDEX "vehicleEdataMeasurementDeviceKey" ON "vehicleEdataMeasurement"
  ("tenantId", "branchId", "deviceImei", "source", "sourceEventId", "parameterId");

DROP INDEX "fleetEventErmKey";
CREATE UNIQUE INDEX "fleetEventDeviceKey" ON "fleetEvent"
  ("tenantId", "branchId", "vehicleId", "deviceImei", "source", "occurredAt", "kind", "troubleCode")
  NULLS NOT DISTINCT WHERE "source" IN ('erm', 'discocan') AND "sourceEventId" IS NULL;

DROP INDEX "fleetEventErmReportKey";
CREATE UNIQUE INDEX "fleetEventDeviceReportKey" ON "fleetEvent"
  ("tenantId", "branchId", "vehicleId", "deviceImei", "source", "sourceEventId", "diagnosticIndex")
  NULLS NOT DISTINCT WHERE "source" IN ('erm', 'discocan') AND "sourceEventId" IS NOT NULL;

COMMIT;
