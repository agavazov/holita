-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "licensePlate" VARCHAR(32) NOT NULL,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "imei" VARCHAR(15) NOT NULL,
    "vehicleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Device_imei_check" CHECK ("imei" ~ '^[0-9]{15}$')
);

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_storeId_createdAt_id_idx" ON "Vehicle"("tenantId", "storeId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_tenantId_storeId_id_key" ON "Vehicle"("tenantId", "storeId", "id");

-- CreateIndex
CREATE INDEX "Device_tenantId_storeId_createdAt_id_idx" ON "Device"("tenantId", "storeId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Device_tenantId_storeId_vehicleId_idx" ON "Device"("tenantId", "storeId", "vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_tenantId_storeId_id_key" ON "Device"("tenantId", "storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Device_tenantId_storeId_imei_key" ON "Device"("tenantId", "storeId", "imei");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_tenantId_storeId_vehicleId_fkey" FOREIGN KEY ("tenantId", "storeId", "vehicleId") REFERENCES "Vehicle"("tenantId", "storeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
