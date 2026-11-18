ALTER TABLE "customer" ADD COLUMN "passwordHash" VARCHAR(255);
CREATE TABLE "shopperSession" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shopperSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shopperSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "shopperSession_tokenHash_key" ON "shopperSession" ("tokenHash");
CREATE INDEX "shopperSession_tenantId_branchId_customerId_idx" ON "shopperSession" ("tenantId", "branchId", "customerId");
