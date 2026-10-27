-- Associations are explicitly established by an operator; existing operations are not a backfill.
ALTER TABLE "Device"
  ADD COLUMN "karmaCarId" VARCHAR(16),
  ADD COLUMN "karmaDeviceId" VARCHAR(128),
  ADD COLUMN "karmaLinkedAt" TIMESTAMPTZ(3),
  ADD CONSTRAINT "Device_karma_link_check" CHECK (
    ("karmaCarId" IS NULL AND "karmaDeviceId" IS NULL AND "karmaLinkedAt" IS NULL)
    OR ("karmaCarId" IS NOT NULL AND "karmaDeviceId" IS NOT NULL AND "karmaLinkedAt" IS NOT NULL
      AND "karmaCarId" ~ '^[1-9][0-9]{0,15}$'
      AND length(btrim("karmaDeviceId")) > 0)
  );

CREATE UNIQUE INDEX "Device_tenantId_branchId_karmaCarId_key"
  ON "Device" ("tenantId", "branchId", "karmaCarId");
CREATE UNIQUE INDEX "Device_tenantId_branchId_karmaDeviceId_key"
  ON "Device" ("tenantId", "branchId", "karmaDeviceId");
