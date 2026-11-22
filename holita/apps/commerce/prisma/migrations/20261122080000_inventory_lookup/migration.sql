CREATE INDEX "productVariant_tenantId_branchId_inventoryTracked_quantity_idx"
ON "productVariant" ("tenantId", "branchId", "inventoryTracked", "quantity");
