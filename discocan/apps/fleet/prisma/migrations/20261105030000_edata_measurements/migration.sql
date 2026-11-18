BEGIN;

CREATE TABLE "vehicleEdataMeasurement" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "vehicleId" UUID NOT NULL,
  "deviceImei" VARCHAR(15) NOT NULL,
  "source" "fleetDataSource" NOT NULL DEFAULT 'erm',
  "sourceEventId" BIGINT NOT NULL,
  "recordedAt" TIMESTAMPTZ(3) NOT NULL,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL,
  "parameterId" INTEGER NOT NULL,
  "parameterType" INTEGER NOT NULL,
  "valueSize" INTEGER NOT NULL,
  "valueHex" VARCHAR(8) NOT NULL,
  "name" TEXT,
  "unit" TEXT,
  CONSTRAINT "vehicleEdataMeasurement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicleEdataMeasurement_source_check" CHECK ("source" = 'erm' AND "sourceEventId" > 0),
  CONSTRAINT "vehicleEdataMeasurement_imei_check" CHECK ("deviceImei" ~ '^[0-9]{15}$'),
  CONSTRAINT "vehicleEdataMeasurement_value_check" CHECK (
    "parameterId" BETWEEN 0 AND 65535 AND "parameterType" BETWEEN 0 AND 255
    AND "valueSize" IN (1, 2, 4) AND length("valueHex") = 2 * "valueSize"
    AND "valueHex" ~ '^[0-9A-Fa-f]+$'
  ),
  CONSTRAINT "vehicleEdataMeasurement_tenantId_branchId_vehicleId_fkey"
    FOREIGN KEY ("tenantId", "branchId", "vehicleId")
    REFERENCES "vehicle" ("tenantId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "vehicleEdataMeasurementErmKey"
  ON "vehicleEdataMeasurement" ("tenantId", "branchId", "deviceImei", "sourceEventId", "parameterId");
CREATE INDEX "vehicleEdataMeasurementVehicleTimeIdx"
  ON "vehicleEdataMeasurement" ("tenantId", "branchId", "vehicleId", "recordedAt" DESC);

COMMIT;
