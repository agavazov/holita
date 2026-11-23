CREATE TABLE "salesImportRecord" (
    "tenantId" UUID NOT NULL,
    "sourceSystem" VARCHAR(32) NOT NULL,
    "entity" VARCHAR(16) NOT NULL,
    "sourceId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "snapshotId" VARCHAR(32) NOT NULL,
    "sourceFingerprint" CHAR(64) NOT NULL,
    "targetFingerprint" CHAR(64) NOT NULL,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedByCoreUserId" UUID NOT NULL,
    "leadCreatorProvenance" VARCHAR(32),
    CONSTRAINT "salesImportRecord_pkey" PRIMARY KEY ("tenantId", "sourceSystem", "entity", "sourceId")
);
