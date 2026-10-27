-- Extend the existing durable operation history; no applied migration or device data is rewritten.
ALTER TYPE "FleetDeviceOperationKind" ADD VALUE 'READ_RULES';
ALTER TYPE "FleetDeviceOperationKind" ADD VALUE 'UPSERT_RULE';
ALTER TYPE "FleetDeviceOperationPhase" ADD VALUE 'READ_RULES';
ALTER TYPE "FleetDeviceOperationPhase" ADD VALUE 'WRITE_RULE';
ALTER TYPE "FleetDeviceOperationPhase" ADD VALUE 'VERIFY_RULES';

ALTER TABLE "FleetDeviceOperation"
  ADD COLUMN "parameterBaselineOperationId" UUID,
  ADD COLUMN "ruleId" INTEGER,
  ADD COLUMN "ruleExpression" VARCHAR(4096),
  ADD COLUMN "ruleTrueEventId" INTEGER,
  ADD COLUMN "ruleFalseEventId" INTEGER,
  ADD COLUMN "ruleDebounceMilliseconds" INTEGER,
  ADD COLUMN "ruleDefinitionHex" VARCHAR(274),
  ADD COLUMN "baselineRules" JSONB,
  ADD COLUMN "rules" JSONB,
  ADD COLUMN "rulesConfigurationId" VARCHAR(16),
  ADD COLUMN "rulesReadAt" TIMESTAMPTZ(3),
  ADD COLUMN "rulesObservations" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "rulesAfterMessageId" VARCHAR(16),
  ADD CONSTRAINT "FleetDeviceOperation_parameter_baseline_scope_fkey"
    FOREIGN KEY ("tenantId", "branchId", "parameterBaselineOperationId")
    REFERENCES "FleetDeviceOperation" ("tenantId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "FleetDeviceOperation"
  DROP CONSTRAINT "FleetDeviceOperation_complete_check",
  DROP CONSTRAINT "FleetDeviceOperation_change_intent_check",
  DROP CONSTRAINT "FleetDeviceOperation_write_marker_check",
  DROP CONSTRAINT "FleetDeviceOperation_change_complete_check";

-- Text comparisons permit adding enum values and constraints in the same migration transaction.
ALTER TABLE "FleetDeviceOperation"
  ADD CONSTRAINT "FleetDeviceOperation_complete_check" CHECK (
    "status" <> 'COMPLETE' OR (
      "dispatchedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND (
        ("kind"::text IN ('READ_RULES', 'UPSERT_RULE')
          AND "rules" IS NOT NULL AND "rulesConfigurationId" IS NOT NULL)
        OR ("kind"::text IN ('READ_CONFIGURATION', 'ADD_PARAMETER', 'UPDATE_INTERVAL')
          AND "configuration" IS NOT NULL AND "configurationId" IS NOT NULL)
      )
    )
  ),
  ADD CONSTRAINT "FleetDeviceOperation_change_intent_check" CHECK (
    ("kind"::text = 'READ_CONFIGURATION' AND "phase"::text = 'READ_PARAMETERS'
      AND "baselineOperationId" IS NULL AND "parameterId" IS NULL AND "intervalSeconds" IS NULL
      AND "writeDispatchedAt" IS NULL)
    OR ("kind"::text IN ('ADD_PARAMETER', 'UPDATE_INTERVAL')
      AND "baselineOperationId" IS NOT NULL AND "baselineOperationId" <> "id"
      AND "parameterId" IS NOT NULL AND "parameterId" BETWEEN 0 AND 65535
      AND "intervalSeconds" IS NOT NULL AND "intervalSeconds" BETWEEN 0 AND 65000
      AND "baselineConfiguration" IS NOT NULL AND jsonb_typeof("baselineConfiguration") = 'array'
      AND "baselineConfigurationId" IS NOT NULL
      AND ("kind"::text <> 'ADD_PARAMETER' OR "catalogId" IS NOT NULL)
      AND ("kind"::text <> 'UPDATE_INTERVAL' OR ("catalogId" IS NULL AND "phase"::text <> 'READ_PROFILE')))
    OR ("kind"::text = 'READ_RULES' AND "phase"::text = 'READ_RULES'
      AND "baselineOperationId" IS NULL AND "parameterBaselineOperationId" IS NULL
      AND "ruleId" IS NULL AND "writeDispatchedAt" IS NULL)
    OR ("kind"::text = 'UPSERT_RULE'
      AND "phase"::text IN ('READ_PARAMETERS', 'READ_RULES', 'WRITE_RULE', 'VERIFY_RULES')
      AND "baselineOperationId" IS NOT NULL AND "baselineOperationId" <> "id"
      AND "parameterBaselineOperationId" IS NOT NULL AND "parameterBaselineOperationId" <> "id"
      AND "ruleId" IS NOT NULL AND "ruleExpression" IS NOT NULL
      AND "ruleTrueEventId" IS NOT NULL AND "ruleFalseEventId" IS NOT NULL
      AND "ruleDebounceMilliseconds" IS NOT NULL AND "ruleDefinitionHex" IS NOT NULL
      AND "baselineRules" IS NOT NULL AND jsonb_typeof("baselineRules") = 'array'
      AND "baselineConfiguration" IS NOT NULL AND jsonb_typeof("baselineConfiguration") = 'array'
      AND "baselineConfigurationId" IS NOT NULL)
  ),
  ADD CONSTRAINT "FleetDeviceOperation_rule_bounds_check" CHECK (
    ("ruleId" IS NULL OR "ruleId" BETWEEN 0 AND 65535)
    AND ("ruleTrueEventId" IS NULL OR "ruleTrueEventId" BETWEEN 0 AND 65535)
    AND ("ruleFalseEventId" IS NULL OR "ruleFalseEventId" BETWEEN 0 AND 65535)
    AND ("ruleDebounceMilliseconds" IS NULL OR "ruleDebounceMilliseconds" BETWEEN 1 AND 32767)
    AND ("ruleDefinitionHex" IS NULL OR (
      "ruleDefinitionHex" ~ '^[0-9A-F]+$'
      AND length("ruleDefinitionHex") BETWEEN 20 AND 274
      AND length("ruleDefinitionHex") % 2 = 0))
    AND ("rules" IS NULL OR jsonb_typeof("rules") = 'array')
    AND ("baselineRules" IS NULL OR jsonb_typeof("baselineRules") = 'array')
    AND jsonb_typeof("rulesObservations") IN ('array', 'object')
    AND ("rulesAfterMessageId" IS NULL OR "rulesAfterMessageId" ~ '^[1-9][0-9]{0,15}$')
  ),
  ADD CONSTRAINT "FleetDeviceOperation_write_marker_check" CHECK (
    "writeDispatchedAt" IS NULL OR (
      "dispatchedAt" IS NOT NULL AND "baselineReadAt" IS NOT NULL AND (
        ("kind"::text IN ('ADD_PARAMETER', 'UPDATE_INTERVAL')
          AND "phase"::text IN ('WRITE_PARAMETER', 'VERIFY_PARAMETERS') AND "definitionHex" IS NOT NULL)
        OR ("kind"::text = 'UPSERT_RULE' AND "phase"::text IN ('WRITE_RULE', 'VERIFY_RULES')
          AND "rulesReadAt" IS NOT NULL AND "ruleDefinitionHex" IS NOT NULL)
      )
    )
  ),
  ADD CONSTRAINT "FleetDeviceOperation_change_complete_check" CHECK (
    "kind"::text IN ('READ_CONFIGURATION', 'READ_RULES') OR "status" <> 'COMPLETE'
    OR ("kind"::text IN ('ADD_PARAMETER', 'UPDATE_INTERVAL')
      AND "phase"::text = 'VERIFY_PARAMETERS' AND "writeDispatchedAt" IS NOT NULL)
    OR ("kind"::text = 'UPSERT_RULE' AND "phase"::text = 'VERIFY_RULES' AND "writeDispatchedAt" IS NOT NULL)
  );

-- The existing active Karma-car index also serializes parameter and rule operations.
