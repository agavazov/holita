BEGIN;

-- CreateEnum
CREATE TYPE "appointmentBookingStatus" AS ENUM ('confirmed', 'cancelled', 'completed', 'noShow');

-- CreateTable
CREATE TABLE "appointmentBooking" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "leadId" UUID,
    "status" "appointmentBookingStatus" NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "blockedUntil" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointmentBooking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "appointmentBooking_snapshot_check" CHECK (
        "durationMinutes" > 0 AND "bufferMinutes" >= 0
        AND "endsAt" = "startsAt" + "durationMinutes" * INTERVAL '1 minute'
        AND "blockedUntil" = "endsAt" + "bufferMinutes" * INTERVAL '1 minute'
    )
);

-- CreateIndex
CREATE INDEX "appointmentBooking_tenantId_serviceId_startsAt_idx" ON "appointmentBooking"("tenantId", "serviceId", "startsAt");

-- CreateIndex
CREATE INDEX "appointmentBooking_tenantId_leadId_idx" ON "appointmentBooking"("tenantId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "appointmentService_tenantId_id_key" ON "appointmentService"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "appointmentBooking" ADD CONSTRAINT "appointmentBooking_tenantId_serviceId_fkey" FOREIGN KEY ("tenantId", "serviceId") REFERENCES "appointmentService"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointmentBooking" ADD CONSTRAINT "appointmentBooking_tenantId_leadId_fkey" FOREIGN KEY ("tenantId", "leadId") REFERENCES "lead"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
