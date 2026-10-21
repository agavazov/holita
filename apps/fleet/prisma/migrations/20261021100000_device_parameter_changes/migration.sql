-- Additive durable operation intent and phases. Existing reads retain their behavior.
CREATE TYPE "FleetDeviceOperationKind" AS ENUM ('READ_CONFIGURATION', 'ADD_PARAMETER', 'UPDATE_INTERVAL');
CREATE TYPE "FleetDeviceOperationPhase" AS ENUM ('READ_PROFILE', 'READ_PARAMETERS', 'WRITE_PARAMETER', 'VERIFY_PARAMETERS');

ALTER TABLE "FleetDeviceOperation"
  ADD COLUMN "kind" "FleetDeviceOperationKind" NOT NULL DEFAULT 'READ_CONFIGURATION',
  ADD COLUMN "phase" "FleetDeviceOperationPhase" NOT NULL DEFAULT 'READ_PARAMETERS',
  ADD COLUMN "baselineOperationId" UUID,
  ADD COLUMN "parameterId" INTEGER,
  ADD COLUMN "intervalSeconds" INTEGER,
  ADD COLUMN "previousIntervalSeconds" INTEGER,
  ADD COLUMN "catalogId" UUID,
  ADD COLUMN "profileId" INTEGER,
  ADD COLUMN "profileReadAt" TIMESTAMPTZ(3),
  ADD COLUMN "profileObservations" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "baselineConfiguration" JSONB,
  ADD COLUMN "baselineConfigurationId" VARCHAR(16),
  ADD COLUMN "baselineObservations" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "baselineReadAt" TIMESTAMPTZ(3),
  ADD COLUMN "definitionHex" VARCHAR(44),
  ADD COLUMN "readAfterMessageId" VARCHAR(16),
  ADD COLUMN "phaseDispatchedAt" TIMESTAMPTZ(3),
  ADD COLUMN "writeDispatchedAt" TIMESTAMPTZ(3),
  ADD COLUMN "writeQueueIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "writeUncertain" BOOLEAN NOT NULL DEFAULT false;

UPDATE "FleetDeviceOperation" SET "phaseDispatchedAt" = "dispatchedAt";

ALTER TABLE "FleetDeviceOperation"
  ADD CONSTRAINT "FleetDeviceOperation_baseline_scope_fkey"
    FOREIGN KEY ("tenantId", "branchId", "baselineOperationId")
    REFERENCES "FleetDeviceOperation" ("tenantId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "FleetDeviceOperation_change_intent_check" CHECK (
    ("kind" = 'READ_CONFIGURATION' AND "phase" = 'READ_PARAMETERS'
      AND "baselineOperationId" IS NULL AND "parameterId" IS NULL AND "intervalSeconds" IS NULL
      AND "writeDispatchedAt" IS NULL)
    OR ("kind" IN ('ADD_PARAMETER', 'UPDATE_INTERVAL')
      AND "baselineOperationId" IS NOT NULL AND "baselineOperationId" <> "id"
      AND "parameterId" IS NOT NULL AND "parameterId" BETWEEN 0 AND 65535
      AND "intervalSeconds" IS NOT NULL AND "intervalSeconds" BETWEEN 0 AND 65000
      AND "baselineConfiguration" IS NOT NULL AND jsonb_typeof("baselineConfiguration") = 'array'
      AND "baselineConfigurationId" IS NOT NULL
      AND ("kind" <> 'ADD_PARAMETER' OR "catalogId" IS NOT NULL)
      AND ("kind" <> 'UPDATE_INTERVAL' OR ("catalogId" IS NULL AND "phase" <> 'READ_PROFILE')))
  ),
  ADD CONSTRAINT "FleetDeviceOperation_change_bounds_check" CHECK (
    cardinality("writeQueueIds") <= 32
    AND ("previousIntervalSeconds" IS NULL OR "previousIntervalSeconds" BETWEEN 0 AND 65535)
    AND ("profileId" IS NULL OR "profileId" BETWEEN 0 AND 65535)
    AND ("definitionHex" IS NULL OR "definitionHex" ~ '^[0-9A-F]{44}$')
    AND ("readAfterMessageId" IS NULL OR "readAfterMessageId" ~ '^[1-9][0-9]{0,15}$')
    AND jsonb_typeof("profileObservations") IN ('array', 'object')
    AND jsonb_typeof("baselineObservations") IN ('array', 'object')
  ),
  ADD CONSTRAINT "FleetDeviceOperation_write_marker_check" CHECK (
    "writeDispatchedAt" IS NULL OR (
      "kind" <> 'READ_CONFIGURATION' AND "phase" IN ('WRITE_PARAMETER', 'VERIFY_PARAMETERS')
      AND "dispatchedAt" IS NOT NULL AND "baselineReadAt" IS NOT NULL AND "definitionHex" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "FleetDeviceOperation_change_complete_check" CHECK (
    "kind" = 'READ_CONFIGURATION' OR "status" <> 'COMPLETE'
    OR ("phase" = 'VERIFY_PARAMETERS' AND "writeDispatchedAt" IS NOT NULL)
  );

-- The existing active_karmaCarId partial unique index deliberately covers every kind.
