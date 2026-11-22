CREATE TABLE "invoice" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "orderNumber" VARCHAR(38) NOT NULL,
  "number" VARCHAR(100) NOT NULL,
  "issueDate" DATE NOT NULL,
  "issuerName" VARCHAR(200) NOT NULL,
  "issuerCompanyId" VARCHAR(100) NOT NULL,
  "issuerAddress" TEXT NOT NULL,
  "issuerVatNumber" VARCHAR(100),
  "recipientName" VARCHAR(200) NOT NULL,
  "recipientAddress" TEXT NOT NULL,
  "recipientCompanyId" VARCHAR(100),
  "recipientVatNumber" VARCHAR(100),
  "recipientEmail" VARCHAR(254),
  "recipientPhone" VARCHAR(100),
  "currency" CHAR(3) NOT NULL,
  "subtotal" DECIMAL(32, 2) NOT NULL,
  "shippingFee" DECIMAL(12, 2) NOT NULL,
  "total" DECIMAL(32, 2) NOT NULL,
  CONSTRAINT "invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_tenantId_branchId_orderId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "orderId") REFERENCES "order" ("tenantId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "invoice_tenantId_branchId_id_key" ON "invoice" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "invoice_tenantId_branchId_orderId_key" ON "invoice" ("tenantId", "branchId", "orderId");
CREATE UNIQUE INDEX "invoice_tenantId_branchId_number_key" ON "invoice" ("tenantId", "branchId", "number");

CREATE TABLE "invoiceLine" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12, 2) NOT NULL,
  "lineTotal" DECIMAL(32, 2) NOT NULL,
  CONSTRAINT "invoiceLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoiceLine_tenantId_branchId_invoiceId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "invoiceId") REFERENCES "invoice" ("tenantId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "invoiceLine_tenantId_branchId_invoiceId_sortOrder_key"
  ON "invoiceLine" ("tenantId", "branchId", "invoiceId", "sortOrder");
