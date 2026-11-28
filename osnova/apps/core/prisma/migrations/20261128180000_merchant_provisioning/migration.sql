-- CreateTable
CREATE TABLE "merchantProvisioning" (
    "platformTenantId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "merchantTenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "merchantName" VARCHAR(200) NOT NULL,
    "adminName" VARCHAR(200) NOT NULL,
    "adminEmail" VARCHAR(254) NOT NULL,
    "branchName" VARCHAR(200) NOT NULL,

    CONSTRAINT "merchantProvisioning_pkey" PRIMARY KEY ("platformTenantId","operationId")
);

-- AddForeignKey
ALTER TABLE "merchantProvisioning" ADD CONSTRAINT "merchantProvisioning_platformTenantId_fkey" FOREIGN KEY ("platformTenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "merchantProvisioning" ADD CONSTRAINT "merchantProvisioning_merchantTenantId_branchId_fkey" FOREIGN KEY ("merchantTenantId", "branchId") REFERENCES "branch"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

