-- CreateEnum
CREATE TYPE "fleetDateFormat" AS ENUM ('YYYY-MM-DD', 'DD-MM-YYYY', 'DD.MM.YYYY');

-- AlterTable
ALTER TABLE "fleetSettings" ADD COLUMN "dateFormat" "fleetDateFormat" NOT NULL DEFAULT 'YYYY-MM-DD',
ADD COLUMN "notificationRetentionDays" INTEGER NOT NULL DEFAULT 7;

-- IANA identifiers are validated by the Settings service rather than a fixed four-zone list.
ALTER TABLE "fleetSettings" DROP CONSTRAINT "fleetSettingsTimeZoneCheck";

ALTER TABLE "fleetSettings" ADD CONSTRAINT "fleetSettingsNotificationRetentionDaysCheck"
CHECK ("notificationRetentionDays" BETWEEN 1 AND 365);
