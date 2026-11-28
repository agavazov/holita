BEGIN;

-- CreateEnum
CREATE TYPE "leadStage" AS ENUM ('new', 'approvedForCall', 'called', 'interested', 'tryLater', 'notInterested', 'won', 'lost');

-- AlterTable
ALTER TABLE "lead" ADD COLUMN "stage" "leadStage" NOT NULL DEFAULT 'new',
ADD COLUMN "stageChangedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "wonAt" TIMESTAMPTZ(3);

COMMIT;
