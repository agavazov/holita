-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventFormat" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID');

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "format" "EventFormat" NOT NULL,
    "capacity" INTEGER,
    "budget" DECIMAL(12,2),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "registrationOpensOn" DATE,
    "registrationClosesOn" DATE,
    "venueId" UUID,
    "meetingUrl" VARCHAR(2000),
    "summary" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Speaker" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254),
    "shortBio" VARCHAR(2000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Speaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTag" (
    "storeId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "EventTag_pkey" PRIMARY KEY ("storeId","eventId","tagId")
);

-- CreateIndex
CREATE INDEX "Event_storeId_deletedAt_startsAt_id_idx" ON "Event"("storeId", "deletedAt", "startsAt", "id");

-- CreateIndex
CREATE INDEX "Event_storeId_venueId_idx" ON "Event"("storeId", "venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_storeId_id_key" ON "Event"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Event_storeId_code_key" ON "Event"("storeId", "code");

-- CreateIndex
CREATE INDEX "Speaker_storeId_createdAt_id_idx" ON "Speaker"("storeId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Speaker_storeId_id_key" ON "Speaker"("storeId", "id");

-- CreateIndex
CREATE INDEX "Tag_storeId_createdAt_id_idx" ON "Tag"("storeId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_storeId_id_key" ON "Tag"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_storeId_name_key" ON "Tag"("storeId", "name");

-- CreateIndex
CREATE INDEX "EventTag_storeId_tagId_idx" ON "EventTag"("storeId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_storeId_id_key" ON "Venue"("storeId", "id");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_storeId_venueId_fkey" FOREIGN KEY ("storeId", "venueId") REFERENCES "Venue"("storeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EventTag" ADD CONSTRAINT "EventTag_storeId_eventId_fkey" FOREIGN KEY ("storeId", "eventId") REFERENCES "Event"("storeId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EventTag" ADD CONSTRAINT "EventTag_storeId_tagId_fkey" FOREIGN KEY ("storeId", "tagId") REFERENCES "Tag"("storeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Reinforce basic scalar and schedule invariants; cross-field messages come from the service.
ALTER TABLE "Event" ADD CONSTRAINT "Event_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "Event" ADD CONSTRAINT "Event_budget_nonnegative" CHECK ("budget" IS NULL OR "budget" >= 0);
ALTER TABLE "Event" ADD CONSTRAINT "Event_schedule_order" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Event" ADD CONSTRAINT "Event_registration_range" CHECK (
  ("registrationOpensOn" IS NULL AND "registrationClosesOn" IS NULL) OR
  ("registrationOpensOn" IS NOT NULL AND "registrationClosesOn" IS NOT NULL AND
   "registrationOpensOn" <= "registrationClosesOn" AND
   "registrationClosesOn" <= ("startsAt" AT TIME ZONE 'Europe/Sofia')::date)
);
