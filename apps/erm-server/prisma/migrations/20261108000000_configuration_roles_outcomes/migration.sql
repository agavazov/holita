CREATE TYPE "ermParameterReadOutcome" AS ENUM ('read', 'rejected', 'omitted');
CREATE TYPE "ermConfigurationOperation" AS ENUM
  ('readEdata', 'interval', 'addDefinition', 'globals', 'parameter', 'parameters');

ALTER TABLE "ermParameterValue"
  ADD COLUMN "outcome" "ermParameterReadOutcome" NOT NULL DEFAULT 'omitted';
UPDATE "ermParameterValue" SET "outcome" = CASE
  WHEN "value" IS NOT NULL THEN 'read'::"ermParameterReadOutcome"
  WHEN "resultCode" IS NOT NULL AND "resultCode" <> '01' THEN 'rejected'::"ermParameterReadOutcome"
  ELSE 'omitted'::"ermParameterReadOutcome"
END;

ALTER TABLE "ermConfigurationChange"
  ADD COLUMN "operation" "ermConfigurationOperation",
  ADD COLUMN "parameters" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "batchId" UUID,
  ADD COLUMN "batchIndex" INTEGER;

-- Named operator runs use their retained audit intent. Legacy tool runs have no intent;
-- their retained baseline and steps distinguish parameter, globals and definition writes.
UPDATE "ermConfigurationChange" SET "operation" = CASE
  WHEN "intent" LIKE 'Read eData configuration%' THEN 'readEdata'::"ermConfigurationOperation"
  WHEN "intent" LIKE 'Set parameters %' THEN 'parameters'::"ermConfigurationOperation"
  WHEN "intent" LIKE 'Set parameter %' THEN 'parameter'::"ermConfigurationOperation"
  WHEN "intent" LIKE 'Set eData globals%' THEN 'globals'::"ermConfigurationOperation"
  WHEN "intent" LIKE 'Add eData parameter %' THEN 'addDefinition'::"ermConfigurationOperation"
  WHEN "intent" LIKE 'Set eData parameter %' THEN 'interval'::"ermConfigurationOperation"
  WHEN "status" = 'read' THEN 'readEdata'::"ermConfigurationOperation"
  WHEN "baseline" ? 'parameter' THEN 'parameter'::"ermConfigurationOperation"
  WHEN "baseline" ? 'globals' THEN 'globals'::"ermConfigurationOperation"
  WHEN "parameter" IS NULL AND "steps" @> '[{"name":"globals"}]'::jsonb
    THEN 'readEdata'::"ermConfigurationOperation"
  WHEN "parameter" IS NULL THEN 'globals'::"ermConfigurationOperation"
  WHEN NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE("baseline"->'definitions', '[]'::jsonb)) definition
    WHERE definition->>'parameter' = "ermConfigurationChange"."parameter"::text
  ) THEN 'addDefinition'::"ermConfigurationOperation"
  ELSE 'interval'::"ermConfigurationOperation"
END;
UPDATE "ermConfigurationChange"
  SET "parameters" = ARRAY["parameter"]
  WHERE "operation" = 'parameter' AND "parameter" IS NOT NULL;
ALTER TABLE "ermConfigurationChange" ALTER COLUMN "operation" SET NOT NULL;

-- Read batches keep their existing action; configuration batches use ordered change rows.
ALTER TABLE "ermCommandBatch"
  ALTER COLUMN "action" DROP NOT NULL,
  ADD COLUMN "finishedAt" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "ermConfigurationChange_batchId_batchIndex_key"
  ON "ermConfigurationChange"("batchId", "batchIndex");
ALTER TABLE "ermConfigurationChange" ADD CONSTRAINT "ermConfigurationChange_tenantId_branchId_batchId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "batchId")
  REFERENCES "ermCommandBatch"("tenantId", "branchId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ermConfigurationChange" ADD CONSTRAINT "ermConfigurationChange_batch_position_check"
  CHECK (("batchId" IS NULL AND "batchIndex" IS NULL)
    OR ("tenantId" IS NOT NULL AND "branchId" IS NOT NULL
      AND "batchId" IS NOT NULL AND "batchIndex" IS NOT NULL AND "batchIndex" >= 0));
