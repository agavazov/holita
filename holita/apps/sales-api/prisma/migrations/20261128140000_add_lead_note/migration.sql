BEGIN;

CREATE TABLE "leadNote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "text" TEXT NOT NULL,
    "authorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leadNote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "leadNote_text_nonblank" CHECK ("text" ~ '[^[:space:]]')
);

CREATE INDEX "leadNote_activity_idx" ON "leadNote"("tenantId", "leadId", "occurredAt" DESC, "createdAt" DESC, "id");

ALTER TABLE "leadNote" ADD CONSTRAINT "leadNote_tenantId_leadId_fkey" FOREIGN KEY ("tenantId", "leadId") REFERENCES "lead"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
