-- Preserve existing IDs, rows and tenant relations while renaming the organizational scope.
BEGIN;
ALTER TABLE "Store" RENAME TO "Branch";
ALTER TABLE "Branch" RENAME CONSTRAINT "Store_pkey" TO "Branch_pkey";
ALTER TABLE "Branch" RENAME CONSTRAINT "Store_tenantId_fkey" TO "Branch_tenantId_fkey";
ALTER INDEX "Store_tenantId_id_key" RENAME TO "Branch_tenantId_id_key";
ALTER INDEX "Store_tenantId_name_id_idx" RENAME TO "Branch_tenantId_name_id_idx";
COMMIT;
