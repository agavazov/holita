BEGIN;

ALTER TABLE "order"
  ALTER COLUMN "cartId" DROP NOT NULL,
  ADD COLUMN "merchantNote" TEXT,
  ADD COLUMN "paymentMethodId" UUID,
  ADD COLUMN "shippingMethodId" UUID,
  ADD CONSTRAINT "order_tenantId_branchId_paymentMethodId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "paymentMethodId") REFERENCES "paymentMethod" ("tenantId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "order_tenantId_branchId_shippingMethodId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "shippingMethodId") REFERENCES "shippingMethod" ("tenantId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
