-- AlterTable
ALTER TABLE "geoZone" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

-- Zone names are unique per Branch among zones that are not deleted; deleted zones keep their history.
CREATE UNIQUE INDEX "geoZone_activeName_key" ON "geoZone"("tenantId", "branchId", "name") WHERE "deletedAt" IS NULL;

-- DropIndex
DROP INDEX "geoZone_tenantId_branchId_name_key";
