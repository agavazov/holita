-- Add fixed read-only diagnostics to the existing scoped operation history.
ALTER TYPE "FleetDeviceOperationKind" ADD VALUE 'READ_FAULT_LOGGER';
ALTER TYPE "FleetDeviceOperationKind" ADD VALUE 'READ_COMMUNICATION_DIAGNOSTICS';
ALTER TYPE "FleetDeviceOperationPhase" ADD VALUE 'READ_DIAGNOSTICS';

ALTER TABLE "FleetDeviceOperation"
  DROP CONSTRAINT "FleetDeviceOperation_complete_check",
  DROP CONSTRAINT "FleetDeviceOperation_change_intent_check",
  DROP CONSTRAINT "FleetDeviceOperation_change_complete_check";

-- Text comparisons allow enum additions within the migration transaction.
ALTER TABLE "FleetDeviceOperation"
  ADD CONSTRAINT "FleetDeviceOperation_complete_check" CHECK (
    "status" <> 'COMPLETE' OR (
      "dispatchedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND (
        ("kind"::text IN ('READ_RULES', 'UPSERT_RULE')
          AND "rules" IS NOT NULL AND "rulesConfigurationId" IS NOT NULL)
        OR ("kind"::text IN ('READ_CONFIGURATION', 'ADD_PARAMETER', 'UPDATE_INTERVAL')
          AND "configuration" IS NOT NULL AND "configurationId" IS NOT NULL)
        OR ("kind"::text IN ('READ_FAULT_LOGGER', 'READ_COMMUNICATION_DIAGNOSTICS')
          AND jsonb_typeof("observations") = 'object'
          AND jsonb_typeof("observations"->'observations') = 'array'
          AND jsonb_array_length("observations"->'observations') > 0)
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

    OR ("kind"::text IN ('READ_FAULT_LOGGER', 'READ_COMMUNICATION_DIAGNOSTICS')
      AND "phase"::text = 'READ_DIAGNOSTICS'
      AND "baselineOperationId" IS NULL AND "parameterBaselineOperationId" IS NULL
      AND "parameterId" IS NULL AND "ruleId" IS NULL AND "writeDispatchedAt" IS NULL)
  ),
  ADD CONSTRAINT "FleetDeviceOperation_change_complete_check" CHECK (
    "kind"::text IN ('READ_CONFIGURATION', 'READ_RULES', 'READ_FAULT_LOGGER', 'READ_COMMUNICATION_DIAGNOSTICS')
    OR "status" <> 'COMPLETE'
    OR ("kind"::text IN ('ADD_PARAMETER', 'UPDATE_INTERVAL')
      AND "phase"::text = 'VERIFY_PARAMETERS' AND "writeDispatchedAt" IS NOT NULL)
    OR ("kind"::text = 'UPSERT_RULE' AND "phase"::text = 'VERIFY_RULES' AND "writeDispatchedAt" IS NOT NULL)
  );
