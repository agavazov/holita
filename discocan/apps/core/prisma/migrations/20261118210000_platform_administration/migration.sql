CREATE TYPE "tenantKind" AS ENUM ('customer', 'platform');
CREATE TYPE "accountStatus" AS ENUM ('active', 'suspended');
ALTER TYPE "userRole" ADD VALUE 'sales';
ALTER TABLE "tenant" ADD COLUMN "kind" "tenantKind" NOT NULL DEFAULT 'customer',
  ADD COLUMN "status" "accountStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "branch" ADD COLUMN "status" "accountStatus" NOT NULL DEFAULT 'active';
CREATE UNIQUE INDEX "tenant_single_platform" ON "tenant" ("kind") WHERE "kind" = 'platform';
