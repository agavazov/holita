CREATE TYPE "invoicePaymentStatus" AS ENUM ('unpaid', 'paid');

CREATE TABLE "invoiceIssuerSettings" (
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "issuerName" VARCHAR(200),
  "issuerCompanyId" VARCHAR(100),
  "issuerAddress" TEXT,
  "issuerVatNumber" VARCHAR(100),
  "issuerRepresentative" VARCHAR(128),
  "issuerBankName" VARCHAR(128),
  "issuerIban" VARCHAR(64),
  "issuerBic" VARCHAR(32),
  CONSTRAINT "invoiceIssuerSettings_pkey" PRIMARY KEY ("tenantId", "branchId")
);

ALTER TABLE "invoice"
  ALTER COLUMN "orderId" DROP NOT NULL,
  ALTER COLUMN "orderNumber" DROP NOT NULL,
  ADD COLUMN "taxEventDate" DATE,
  ADD COLUMN "dueDate" DATE,
  ADD COLUMN "paymentTermDays" INTEGER,
  ADD COLUMN "paymentMethod" VARCHAR(200),
  ADD COLUMN "paymentStatus" "invoicePaymentStatus",
  ADD COLUMN "reason" VARCHAR(255),
  ADD COLUMN "note" TEXT,
  ADD COLUMN "issuerRepresentative" VARCHAR(128),
  ADD COLUMN "issuerBankName" VARCHAR(128),
  ADD COLUMN "issuerIban" VARCHAR(64),
  ADD COLUMN "issuerBic" VARCHAR(32),
  ADD CONSTRAINT "invoice_orderSnapshot_check" CHECK (("orderId" IS NULL) = ("orderNumber" IS NULL));

ALTER TABLE "invoiceLine" ADD COLUMN "unit" VARCHAR(32);
