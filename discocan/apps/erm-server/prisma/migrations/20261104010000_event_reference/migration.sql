ALTER TABLE "ermEvent" ADD COLUMN "reference" VARCHAR(10);

UPDATE "ermEvent" AS event
SET "reference" = frame."reference"
FROM "ermFrame" AS frame
WHERE event."frameId" = frame."id"
  AND frame."command" IN ('06', '86');

DELETE FROM "ermEvent" AS later
USING "ermEvent" AS earlier
WHERE earlier."id" < later."id"
  AND earlier."unitId" = later."unitId"
  AND earlier."eventId" IS NOT DISTINCT FROM later."eventId"
  AND earlier."eventTime" = later."eventTime"
  AND later."eventTime" IS NOT NULL
  AND earlier."positionTime" IS NOT DISTINCT FROM later."positionTime"
  AND earlier."latitude" IS NOT DISTINCT FROM later."latitude"
  AND earlier."longitude" IS NOT DISTINCT FROM later."longitude"
  AND earlier."speedKmh" IS NOT DISTINCT FROM later."speedKmh"
  AND earlier."heading" IS NOT DISTINCT FROM later."heading"
  AND earlier."odometer" IS NOT DISTINCT FROM later."odometer"
  AND earlier."engineOn" IS NOT DISTINCT FROM later."engineOn"
  AND earlier."mainVoltage" IS NOT DISTINCT FROM later."mainVoltage"
  AND earlier."backupVoltage" IS NOT DISTINCT FROM later."backupVoltage"
  AND earlier."fields" = later."fields";

CREATE UNIQUE INDEX "ermEvent_unitId_reference_eventId_eventTime_key"
ON "ermEvent" ("unitId", "reference", "eventId", "eventTime") NULLS NOT DISTINCT
WHERE "reference" IS NOT NULL AND "eventTime" IS NOT NULL;
