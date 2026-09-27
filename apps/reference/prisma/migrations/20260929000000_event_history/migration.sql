CREATE TYPE "EventHistoryOperation" AS ENUM ('CREATED', 'UPDATED', 'TRASHED', 'RESTORED', 'SESSION_CREATED', 'SESSION_UPDATED', 'SESSION_DELETED', 'SESSIONS_REORDERED', 'MEDIA_ADDED', 'MEDIA_UPDATED', 'MEDIA_REMOVED', 'MEDIA_REORDERED', 'COVER_CHANGED');

CREATE TABLE "EventHistory" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "operation" "EventHistoryOperation" NOT NULL,
  "subject" VARCHAR(255),
  "actor" VARCHAR(20) NOT NULL DEFAULT 'Anonymous',
  "changes" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventHistory_storeId_eventId_fkey" FOREIGN KEY ("storeId", "eventId") REFERENCES "Event"("storeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "EventHistory_storeId_eventId_createdAt_id_idx" ON "EventHistory"("storeId", "eventId", "createdAt", "id");
