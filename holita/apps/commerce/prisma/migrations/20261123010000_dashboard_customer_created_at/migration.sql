CREATE INDEX "customer_tenantId_branchId_createdAt_idx"
  ON "customer" ("tenantId", "branchId", "createdAt");
