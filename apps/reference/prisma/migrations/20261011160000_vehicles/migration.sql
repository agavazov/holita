CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "licensePlate" VARCHAR(32) NOT NULL,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Vehicle_storeId_id_key" ON "Vehicle"("storeId", "id");
CREATE INDEX "Vehicle_storeId_createdAt_id_idx" ON "Vehicle"("storeId", "createdAt", "id");
