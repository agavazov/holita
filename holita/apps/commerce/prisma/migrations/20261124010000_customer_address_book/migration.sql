BEGIN;

CREATE TYPE "customerAddressType" AS ENUM ('general', 'shipping', 'billing');

ALTER TABLE "customerAddress"
  ADD COLUMN "type" "customerAddressType" NOT NULL DEFAULT 'general',
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "line2" VARCHAR(200),
  ADD COLUMN "phone" VARCHAR(50),
  ADD CONSTRAINT "customerAddress_general_not_default_check"
    CHECK ("type" <> 'general' OR NOT "isDefault");

CREATE UNIQUE INDEX "customerAddress_default_type_key"
  ON "customerAddress" ("tenantId", "branchId", "customerId", "type")
  WHERE "isDefault";

COMMIT;
