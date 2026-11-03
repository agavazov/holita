BEGIN;

-- AlterTable
ALTER TABLE "device" ADD COLUMN     "smsPassword" VARCHAR(16);

-- Hand-written check for the StarLink Simple SMS password (parameter 0593).
ALTER TABLE "device" ADD CONSTRAINT "deviceSmsPasswordCheck"
  CHECK ("smsPassword" IS NULL OR "smsPassword" ~ '^[0-9A-Za-z]{1,16}$');

COMMIT;
