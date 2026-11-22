CREATE TABLE "characteristicGroup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "characteristicGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "characteristic" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "characteristic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "productCharacteristicValue" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "characteristicId" UUID NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "productCharacteristicValue_pkey" PRIMARY KEY ("tenantId", "branchId", "productId", "characteristicId")
);

CREATE UNIQUE INDEX "characteristicGroup_tenantId_branchId_id_key" ON "characteristicGroup"("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "characteristicGroup_tenantId_branchId_name_key" ON "characteristicGroup"("tenantId", "branchId", "name");
CREATE INDEX "characteristicGroup_tenantId_branchId_sortOrder_id_idx" ON "characteristicGroup"("tenantId", "branchId", "sortOrder", "id");
CREATE UNIQUE INDEX "characteristic_tenantId_branchId_id_key" ON "characteristic"("tenantId", "branchId", "id");
CREATE INDEX "characteristic_tenantId_branchId_groupId_sortOrder_id_idx" ON "characteristic"("tenantId", "branchId", "groupId", "sortOrder", "id");
CREATE INDEX "productCharacteristicValue_tenantId_branchId_characteristic_idx" ON "productCharacteristicValue"("tenantId", "branchId", "characteristicId");

ALTER TABLE "characteristic" ADD CONSTRAINT "characteristic_tenantId_branchId_groupId_fkey" FOREIGN KEY ("tenantId", "branchId", "groupId") REFERENCES "characteristicGroup"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "productCharacteristicValue" ADD CONSTRAINT "productCharacteristicValue_tenantId_branchId_productId_fkey" FOREIGN KEY ("tenantId", "branchId", "productId") REFERENCES "product"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "productCharacteristicValue" ADD CONSTRAINT "productCharacteristicValue_tenantId_branchId_characteristi_fkey" FOREIGN KEY ("tenantId", "branchId", "characteristicId") REFERENCES "characteristic"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
