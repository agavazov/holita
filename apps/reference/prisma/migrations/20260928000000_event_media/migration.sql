CREATE TYPE "UploadState" AS ENUM ('PENDING', 'UPLOADING', 'UPLOADED', 'FINALIZED', 'DELETING');
ALTER TABLE "Event" ADD COLUMN "coverMediaId" UUID;

CREATE TABLE "UploadIntent" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "fileKey" UUID NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(100) NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "finalizeExpiresAt" TIMESTAMPTZ(3) NOT NULL,
  "state" "UploadState" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "UploadIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UploadIntent_size_check" CHECK ("byteSize" BETWEEN 1 AND 5242880)
);
CREATE UNIQUE INDEX "UploadIntent_fileKey_key" ON "UploadIntent"("fileKey");
CREATE UNIQUE INDEX "UploadIntent_storeId_eventId_id_key" ON "UploadIntent"("storeId", "eventId", "id");
CREATE INDEX "UploadIntent_state_expiresAt_idx" ON "UploadIntent"("state", "expiresAt");
CREATE INDEX "UploadIntent_state_finalizeExpiresAt_idx" ON "UploadIntent"("state", "finalizeExpiresAt");
CREATE INDEX "UploadIntent_storeId_eventId_state_idx" ON "UploadIntent"("storeId", "eventId", "state");
ALTER TABLE "UploadIntent" ADD CONSTRAINT "UploadIntent_storeId_eventId_fkey" FOREIGN KEY ("storeId", "eventId") REFERENCES "Event"("storeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "EventMedia" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "uploadId" UUID NOT NULL,
  "fileKey" UUID NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(100) NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "altText" VARCHAR(300),
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventMedia_size_check" CHECK ("byteSize" BETWEEN 1 AND 5242880),
  CONSTRAINT "EventMedia_position_check" CHECK ("position" >= 0)
);
CREATE UNIQUE INDEX "EventMedia_uploadId_key" ON "EventMedia"("uploadId");
CREATE UNIQUE INDEX "EventMedia_fileKey_key" ON "EventMedia"("fileKey");
CREATE UNIQUE INDEX "EventMedia_storeId_eventId_id_key" ON "EventMedia"("storeId", "eventId", "id");
CREATE UNIQUE INDEX "EventMedia_storeId_eventId_uploadId_key" ON "EventMedia"("storeId", "eventId", "uploadId");
CREATE INDEX "EventMedia_storeId_eventId_position_id_idx" ON "EventMedia"("storeId", "eventId", "position", "id");
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_storeId_eventId_fkey" FOREIGN KEY ("storeId", "eventId") REFERENCES "Event"("storeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_storeId_eventId_uploadId_fkey" FOREIGN KEY ("storeId", "eventId", "uploadId") REFERENCES "UploadIntent"("storeId", "eventId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Event" ADD CONSTRAINT "Event_storeId_id_coverMediaId_fkey" FOREIGN KEY ("storeId", "id", "coverMediaId") REFERENCES "EventMedia"("storeId", "eventId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
