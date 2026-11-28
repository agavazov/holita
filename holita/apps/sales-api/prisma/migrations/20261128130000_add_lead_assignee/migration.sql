BEGIN;

ALTER TABLE "lead" ADD COLUMN "assignedAgentUserId" UUID;

CREATE INDEX "lead_tenantId_assignedAgentUserId_idx" ON "lead"("tenantId", "assignedAgentUserId");

COMMIT;
