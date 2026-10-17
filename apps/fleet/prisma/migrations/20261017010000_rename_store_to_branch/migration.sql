-- Column renames preserve values and physical order: id, tenantId, branchId.
BEGIN;
ALTER TABLE "Vehicle" RENAME COLUMN "storeId" TO "branchId";
ALTER TABLE "Device" RENAME COLUMN "storeId" TO "branchId";
ALTER INDEX "Vehicle_tenantId_storeId_id_key" RENAME TO "Vehicle_tenantId_branchId_id_key";
ALTER INDEX "Vehicle_tenantId_storeId_createdAt_id_idx" RENAME TO "Vehicle_tenantId_branchId_createdAt_id_idx";
ALTER INDEX "Device_tenantId_storeId_id_key" RENAME TO "Device_tenantId_branchId_id_key";
ALTER INDEX "Device_tenantId_storeId_imei_key" RENAME TO "Device_tenantId_branchId_imei_key";
ALTER INDEX "Device_tenantId_storeId_createdAt_id_idx" RENAME TO "Device_tenantId_branchId_createdAt_id_idx";
ALTER INDEX "Device_tenantId_storeId_vehicleId_idx" RENAME TO "Device_tenantId_branchId_vehicleId_idx";
ALTER TABLE "Device" RENAME CONSTRAINT "Device_tenantId_storeId_vehicleId_fkey" TO "Device_tenantId_branchId_vehicleId_fkey";
COMMIT;
