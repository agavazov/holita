CREATE TYPE "leadContactRole" AS ENUM ('owner', 'manager', 'employee', 'technical', 'unknown');

CREATE TABLE "leadContact" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "name" VARCHAR(255),
    "phone" VARCHAR(16),
    "email" VARCHAR(255),
    "role" "leadContactRole" NOT NULL DEFAULT 'unknown',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leadContact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "leadContact_identity_check" CHECK ("name" IS NOT NULL OR "phone" IS NOT NULL OR "email" IS NOT NULL),
    CONSTRAINT "leadContact_tenantId_leadId_fkey" FOREIGN KEY ("tenantId", "leadId")
      REFERENCES "lead"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "leadContact_tenantId_leadId_idx" ON "leadContact"("tenantId", "leadId");
CREATE UNIQUE INDEX "leadContact_primary_key" ON "leadContact"("tenantId", "leadId") WHERE "isPrimary";
