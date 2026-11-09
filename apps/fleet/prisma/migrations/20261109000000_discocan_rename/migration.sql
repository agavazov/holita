BEGIN;

ALTER TYPE "fleetDeviceRouting" RENAME VALUE 'holita' TO 'discocan';

UPDATE "fleetNotification"
SET "parameters" = jsonb_set("parameters", '{eventKind}', '"UNIT_RETURNED_TO_DISCOCAN"')
WHERE "parameters"->>'eventKind' = 'UNIT_RETURNED_TO_HOLITA';

COMMIT;
