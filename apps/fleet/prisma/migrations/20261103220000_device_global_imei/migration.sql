BEGIN;

-- DropIndex
DROP INDEX "device_tenantId_branchId_imei_key";

-- CreateIndex
CREATE UNIQUE INDEX "device_imei_key" ON "device"("imei");

COMMIT;
