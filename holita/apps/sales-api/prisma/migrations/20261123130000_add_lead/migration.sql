CREATE TABLE "lead" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "displayName" VARCHAR(255),
    "websiteUrl" VARCHAR(2048),
    "sourceName" VARCHAR(255),
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lead_identity_check" CHECK ("displayName" IS NOT NULL OR "websiteUrl" IS NOT NULL)
);

CREATE UNIQUE INDEX "lead_tenantId_id_key" ON "lead"("tenantId", "id");
CREATE INDEX "lead_tenantId_createdAt_id_idx" ON "lead"("tenantId", "createdAt", "id");
