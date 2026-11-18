-- CreateEnum
CREATE TYPE "userRole" AS ENUM ('viewer', 'operator', 'engineer', 'administrator');

-- Preserve existing users' access while new users default to read-only.
ALTER TABLE "user" ADD COLUMN "role" "userRole" NOT NULL DEFAULT 'administrator';
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'viewer';
