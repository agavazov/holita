-- CreateTable
CREATE TABLE "vehicleFaultCheck" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "checkedAt" TIMESTAMPTZ(3) NOT NULL,
    "dataAsOf" TIMESTAMPTZ(3),
    "findings" JSONB NOT NULL,

    CONSTRAINT "vehicleFaultCheck_pkey" PRIMARY KEY ("tenantId","branchId","vehicleId"),
    CONSTRAINT "vehicleFaultCheck_findings_check" CHECK (jsonb_typeof("findings") = 'array')
);

-- AddForeignKey
ALTER TABLE "vehicleFaultCheck" ADD CONSTRAINT "vehicleFaultCheck_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "vehicle"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;
