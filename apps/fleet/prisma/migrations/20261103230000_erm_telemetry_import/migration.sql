BEGIN;

-- AlterEnum
ALTER TYPE "fleetDataSource" ADD VALUE 'erm';

-- CreateTable
CREATE TABLE "fleetErmCursor" (
    "deviceId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "lastEventId" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fleetErmCursor_pkey" PRIMARY KEY ("deviceId"),
    CONSTRAINT "fleetErmCursorLastEventIdCheck" CHECK ("lastEventId" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "fleetErmCursor_tenantId_branchId_deviceId_key" ON "fleetErmCursor"("tenantId", "branchId", "deviceId");

-- AddForeignKey
ALTER TABLE "fleetErmCursor" ADD CONSTRAINT "fleetErmCursor_tenantId_branchId_deviceId_fkey" FOREIGN KEY ("tenantId", "branchId", "deviceId") REFERENCES "device"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

COMMIT;
