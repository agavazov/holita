BEGIN;

-- CreateTable
CREATE TABLE "shopperPasswordReset" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shopperPasswordReset_pkey" PRIMARY KEY ("tenantId","branchId","customerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopperPasswordReset_tokenHash_key" ON "shopperPasswordReset"("tokenHash");

-- AddForeignKey
ALTER TABLE "shopperPasswordReset" ADD CONSTRAINT "shopperPasswordReset_tenantId_branchId_customerId_fkey" FOREIGN KEY ("tenantId", "branchId", "customerId") REFERENCES "customer"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
