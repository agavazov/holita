BEGIN;

ALTER TABLE "cart" ADD COLUMN "consumedAt" TIMESTAMPTZ(3);
DROP INDEX "cart_tenantId_branchId_customerId_key";
CREATE UNIQUE INDEX "cart_tenantId_branchId_customerId_key" ON "cart" ("tenantId", "branchId", "customerId")
  WHERE "consumedAt" IS NULL;

CREATE TYPE "orderStatus" AS ENUM ('placed');
CREATE TYPE "orderPaymentStatus" AS ENUM ('unpaid');

CREATE TABLE "order" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "cartId" UUID NOT NULL,
  "customerId" UUID,
  "orderNumber" VARCHAR(38) NOT NULL,
  "status" "orderStatus" NOT NULL DEFAULT 'placed',
  "paymentStatus" "orderPaymentStatus" NOT NULL DEFAULT 'unpaid',
  "placedAt" TIMESTAMPTZ(3) NOT NULL,
  "contactName" VARCHAR(200) NOT NULL,
  "contactEmail" VARCHAR(254) NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "shippingCountryCode" CHAR(2) NOT NULL,
  "shippingCity" TEXT NOT NULL,
  "shippingPostalCode" TEXT NOT NULL,
  "shippingLine1" TEXT NOT NULL,
  "shippingLine2" TEXT,
  "paymentMethodLabel" VARCHAR(200) NOT NULL,
  "paymentInstructions" TEXT NOT NULL,
  "shippingMethodLabel" VARCHAR(200) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "subtotal" DECIMAL(32,2) NOT NULL,
  "shippingFee" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(32,2) NOT NULL,
  CONSTRAINT "order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_tenantId_branchId_cartId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "cartId") REFERENCES "cart" ("tenantId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_tenantId_branchId_customerId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "customerId") REFERENCES "customer" ("tenantId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "order_tenantId_branchId_id_key" ON "order" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "order_tenantId_branchId_cartId_key" ON "order" ("tenantId", "branchId", "cartId");
CREATE UNIQUE INDEX "order_tenantId_branchId_orderNumber_key" ON "order" ("tenantId", "branchId", "orderNumber");
CREATE INDEX "order_tenantId_branchId_customerId_idx" ON "order" ("tenantId", "branchId", "customerId");

CREATE TABLE "orderLine" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "variantId" UUID,
  "sortOrder" INTEGER NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "label" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "stockDecremented" BOOLEAN NOT NULL,
  CONSTRAINT "orderLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orderLine_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "orderLine_tenantId_branchId_orderId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "orderId") REFERENCES "order" ("tenantId", "branchId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- A product edit can replace retained variant IDs in one transaction.
  CONSTRAINT "orderLine_tenantId_branchId_variantId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "variantId") REFERENCES "productVariant" ("tenantId", "branchId", "id")
    ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX "orderLine_tenantId_branchId_orderId_sortOrder_key" ON "orderLine" ("tenantId", "branchId", "orderId", "sortOrder");
CREATE INDEX "orderLine_tenantId_branchId_variantId_idx" ON "orderLine" ("tenantId", "branchId", "variantId");

COMMIT;
