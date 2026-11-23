ALTER TABLE "order"
    ADD COLUMN "billingName" VARCHAR(200),
    ADD COLUMN "billingPhone" TEXT,
    ADD COLUMN "billingCountryCode" CHAR(2),
    ADD COLUMN "billingCity" TEXT,
    ADD COLUMN "billingPostalCode" TEXT,
    ADD COLUMN "billingLine1" TEXT,
    ADD COLUMN "billingLine2" TEXT;
