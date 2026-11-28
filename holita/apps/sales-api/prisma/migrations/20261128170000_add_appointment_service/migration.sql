BEGIN;

CREATE TYPE "appointmentServiceColor" AS ENUM ('c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8');

CREATE TABLE "appointmentService" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "color" "appointmentServiceColor" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL,
    "weekdays" INTEGER[] NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointmentService_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "appointmentService_name_check" CHECK (btrim("name") <> ''),
    CONSTRAINT "appointmentService_weekdays_check" CHECK (
        cardinality("weekdays") > 0 AND "weekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]
    ),
    CONSTRAINT "appointmentService_window_check" CHECK (
        "startMinute" >= 0 AND "endMinute" < 1440
        AND "durationMinutes" > 0 AND "bufferMinutes" >= 0
        AND "endMinute"::bigint - "startMinute" >= "durationMinutes"::bigint + "bufferMinutes"
    )
);

CREATE INDEX "appointmentService_tenantId_name_id_idx" ON "appointmentService"("tenantId", "name", "id");

COMMIT;
