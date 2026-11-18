-- Automatic returns belong to the physical unit; only operator returns have a Branch and Device.
ALTER TABLE "ermKarmaReturnAttempt"
    ALTER COLUMN "tenantId" DROP NOT NULL,
    ALTER COLUMN "branchId" DROP NOT NULL,
    ALTER COLUMN "deviceId" DROP NOT NULL,
    ADD CONSTRAINT "ermKarmaReturnAttempt_scope_check" CHECK (num_nulls("tenantId", "branchId", "deviceId") IN (0, 3));
