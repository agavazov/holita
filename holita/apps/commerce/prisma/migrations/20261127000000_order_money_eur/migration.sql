BEGIN;

UPDATE "order" SET "currency" = 'EUR' WHERE "currency" = 'BGN';
UPDATE "invoice" SET "currency" = 'EUR' WHERE "currency" = 'BGN';
UPDATE "orderRefund" SET "currency" = 'EUR' WHERE "currency" = 'BGN';

COMMIT;
