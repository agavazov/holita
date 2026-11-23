CREATE TYPE "characteristicKind" AS ENUM ('text', 'singleChoice', 'multipleChoice');

ALTER TABLE "characteristic" ADD COLUMN "kind" "characteristicKind" NOT NULL DEFAULT 'text';

CREATE TABLE "characteristicGroupCategory" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "characteristicGroupCategory_pkey" PRIMARY KEY ("tenantId", "branchId", "groupId", "categoryId")
);

CREATE TABLE "characteristicChoice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "characteristicId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,

    CONSTRAINT "characteristicChoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "productCharacteristicChoice" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "characteristicId" UUID NOT NULL,
    "choiceId" UUID NOT NULL,

    CONSTRAINT "productCharacteristicChoice_pkey" PRIMARY KEY ("tenantId", "branchId", "productId", "characteristicId", "choiceId")
);

CREATE INDEX "characteristicGroupCategory_tenantId_branchId_categoryId_idx" ON "characteristicGroupCategory"("tenantId", "branchId", "categoryId");
CREATE UNIQUE INDEX "characteristicChoice_tenantId_branchId_characteristicId_id_key" ON "characteristicChoice"("tenantId", "branchId", "characteristicId", "id");
CREATE INDEX "productCharacteristicChoice_tenantId_branchId_choiceId_idx" ON "productCharacteristicChoice"("tenantId", "branchId", "choiceId");

ALTER TABLE "characteristicGroupCategory" ADD CONSTRAINT "characteristicGroupCategory_tenantId_branchId_groupId_fkey" FOREIGN KEY ("tenantId", "branchId", "groupId") REFERENCES "characteristicGroup"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "characteristicGroupCategory" ADD CONSTRAINT "characteristicGroupCategory_tenantId_branchId_categoryId_fkey" FOREIGN KEY ("tenantId", "branchId", "categoryId") REFERENCES "category"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "characteristicChoice" ADD CONSTRAINT "characteristicChoice_tenantId_branchId_characteristicId_fkey" FOREIGN KEY ("tenantId", "branchId", "characteristicId") REFERENCES "characteristic"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "productCharacteristicChoice" ADD CONSTRAINT "productCharacteristicChoice_tenantId_branchId_productId_fkey" FOREIGN KEY ("tenantId", "branchId", "productId") REFERENCES "product"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "productCharacteristicChoice" ADD CONSTRAINT "productCharacteristicChoice_tenantId_branchId_characterist_fkey" FOREIGN KEY ("tenantId", "branchId", "characteristicId", "choiceId") REFERENCES "characteristicChoice"("tenantId", "branchId", "characteristicId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
