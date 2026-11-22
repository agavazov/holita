BEGIN;

CREATE TABLE "cart" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "customerId" UUID,
  "guestTokenHash" CHAR(64),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "cart_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cart_owner_check" CHECK (num_nonnulls("customerId", "guestTokenHash") = 1)
);

CREATE TABLE "cartLine" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "cartId" UUID NOT NULL,
  "variantId" UUID,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cartLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cartLine_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "cart_tenantId_branchId_id_key" ON "cart" ("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "cart_tenantId_branchId_customerId_key" ON "cart" ("tenantId", "branchId", "customerId");
CREATE UNIQUE INDEX "cart_tenantId_branchId_guestTokenHash_key" ON "cart" ("tenantId", "branchId", "guestTokenHash");
CREATE UNIQUE INDEX "cartLine_tenantId_branchId_cartId_variantId_key" ON "cartLine" ("tenantId", "branchId", "cartId", "variantId");
CREATE INDEX "cartLine_tenantId_branchId_variantId_idx" ON "cartLine" ("tenantId", "branchId", "variantId");

ALTER TABLE "cart" ADD CONSTRAINT "cart_tenantId_branchId_customerId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "customerId") REFERENCES "customer" ("tenantId", "branchId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cartLine" ADD CONSTRAINT "cartLine_tenantId_branchId_cartId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "cartId") REFERENCES "cart" ("tenantId", "branchId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
-- Product edits replace variant rows in one transaction while preserving retained IDs.
ALTER TABLE "cartLine" ADD CONSTRAINT "cartLine_tenantId_branchId_variantId_fkey"
  FOREIGN KEY ("tenantId", "branchId", "variantId") REFERENCES "productVariant" ("tenantId", "branchId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

COMMIT;
