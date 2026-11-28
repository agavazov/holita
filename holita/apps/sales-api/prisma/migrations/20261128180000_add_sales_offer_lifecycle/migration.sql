BEGIN;

ALTER TYPE "salesOfferStatus" ADD VALUE 'prepared';
ALTER TYPE "salesOfferStatus" ADD VALUE 'manuallySent';

ALTER TABLE "salesOffer"
    ADD COLUMN "preparedAt" TIMESTAMPTZ(3),
    ADD COLUMN "manuallySentAt" TIMESTAMPTZ(3),
    -- Compare text so the new enum labels can be checked in the same transaction.
    ADD CONSTRAINT "salesOffer_lifecycle_check" CHECK (
        ("preparedAt" IS NOT NULL) = ("status"::text IN ('prepared', 'manuallySent'))
        AND ("manuallySentAt" IS NOT NULL) = ("status"::text = 'manuallySent')
    );

COMMIT;
