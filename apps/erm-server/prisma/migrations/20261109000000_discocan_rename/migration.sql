BEGIN;

ALTER TABLE "ermKarmaRouting" DROP CONSTRAINT "ermKarmaRouting_notificationKind_check";

ALTER TYPE "ermDirection" RENAME VALUE 'holita' TO 'discocan';
ALTER TYPE "ermRecoveryOutcome" RENAME VALUE 'alreadyHolita' TO 'alreadyDiscoCan';
ALTER TYPE "ermKarmaRoutingState" RENAME VALUE 'holita' TO 'discocan';

UPDATE "ermKarmaRouting"
SET "notificationKind" = 'UNIT_RETURNED_TO_DISCOCAN'
WHERE "notificationKind" = 'UNIT_RETURNED_TO_HOLITA';

ALTER TABLE "ermKarmaRouting" ADD CONSTRAINT "ermKarmaRouting_notificationKind_check" CHECK (
    "notificationKind" IS NULL
    OR ("notificationKind" = 'UNIT_ON_BACKUP' AND "state" = 'karmaBackup')
    OR ("notificationKind" = 'UNIT_RETURNED_TO_DISCOCAN' AND "state" = 'discocan')
);

ALTER TABLE "ermKarmaReturnAttempt" RENAME COLUMN "holitaConnectionId" TO "discocanConnectionId";
ALTER TABLE "ermKarmaReturnAttempt" RENAME CONSTRAINT "ermKarmaReturnAttempt_holitaConnectionId_fkey" TO "ermKarmaReturnAttempt_discocanConnectionId_fkey";

COMMIT;
