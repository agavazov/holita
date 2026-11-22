BEGIN;

ALTER TABLE "customer" ADD COLUMN "phone" VARCHAR(50);

CREATE TABLE "customerAddress" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "recipient" VARCHAR(200) NOT NULL,
  "line1" VARCHAR(200) NOT NULL,
  "city" VARCHAR(120) NOT NULL,
  "postalCode" VARCHAR(20) NOT NULL,
  "countryCode" CHAR(2) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customerAddress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customerAddress_tenantId_branchId_customerId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "customerId") REFERENCES "customer" ("tenantId", "branchId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "customerAddress_tenantId_branchId_customerId_createdAt_id_idx"
  ON "customerAddress" ("tenantId", "branchId", "customerId", "createdAt", "id");

COMMIT;
