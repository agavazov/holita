CREATE TABLE "Session" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "summary" VARCHAR(2000),
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "room" VARCHAR(120),
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Session_schedule_order" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "Session_position_nonnegative" CHECK ("position" >= 0)
);
CREATE TABLE "SessionSpeaker" (
  "storeId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "speakerId" UUID NOT NULL,
  CONSTRAINT "SessionSpeaker_pkey" PRIMARY KEY ("storeId", "sessionId", "speakerId")
);
CREATE UNIQUE INDEX "Session_storeId_id_key" ON "Session"("storeId", "id");
CREATE INDEX "Session_storeId_eventId_position_id_idx" ON "Session"("storeId", "eventId", "position", "id");
CREATE INDEX "SessionSpeaker_storeId_speakerId_idx" ON "SessionSpeaker"("storeId", "speakerId");
ALTER TABLE "Session" ADD CONSTRAINT "Session_storeId_eventId_fkey" FOREIGN KEY ("storeId", "eventId") REFERENCES "Event"("storeId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "SessionSpeaker" ADD CONSTRAINT "SessionSpeaker_storeId_sessionId_fkey" FOREIGN KEY ("storeId", "sessionId") REFERENCES "Session"("storeId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "SessionSpeaker" ADD CONSTRAINT "SessionSpeaker_storeId_speakerId_fkey" FOREIGN KEY ("storeId", "speakerId") REFERENCES "Speaker"("storeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
