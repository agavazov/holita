BEGIN;

-- CreateEnum
CREATE TYPE "leadTaskType" AS ENUM ('outreach', 'prepareDemoSite', 'prepareSendOffer', 'demo', 'research');

-- CreateEnum
CREATE TYPE "leadTaskStatus" AS ENUM ('pending', 'inProgress', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "leadTask" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "type" "leadTaskType" NOT NULL,
    "status" "leadTaskStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leadTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leadTask_schedule_idx" ON "leadTask"("tenantId", "leadId", "scheduledAt", "id");

-- AddForeignKey
ALTER TABLE "leadTask" ADD CONSTRAINT "leadTask_tenantId_leadId_fkey" FOREIGN KEY ("tenantId", "leadId") REFERENCES "lead"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
