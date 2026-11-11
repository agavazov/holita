-- CreateEnum
CREATE TYPE "fleetGeoZoneEventKind" AS ENUM ('enter', 'exit');

-- CreateTable
CREATE TABLE "geoZone" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "polygon" JSONB NOT NULL,
    "minLatitude" DOUBLE PRECISION NOT NULL,
    "maxLatitude" DOUBLE PRECISION NOT NULL,
    "minLongitude" DOUBLE PRECISION NOT NULL,
    "maxLongitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geoZone_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "geoZone_polygon_check" CHECK (
        "polygon"->>'type' = 'Polygon' AND jsonb_typeof("polygon"->'coordinates') = 'array'
    ),
    CONSTRAINT "geoZone_bbox_check" CHECK (
        "minLatitude" BETWEEN -90 AND 90 AND "maxLatitude" BETWEEN "minLatitude" AND 90
        AND "minLongitude" BETWEEN -180 AND 180 AND "maxLongitude" BETWEEN "minLongitude" AND 180
    )
);

-- CreateTable
CREATE TABLE "geoZoneEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "kind" "fleetGeoZoneEventKind" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "sampleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geoZoneEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "geoZoneEvent_coordinates_check" CHECK (
        "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180
    )
);

-- CreateTable
CREATE TABLE "geoZoneCursor" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "sampleCreatedAt" TIMESTAMPTZ(3) NOT NULL,
    "sampleId" UUID NOT NULL,

    CONSTRAINT "geoZoneCursor_pkey" PRIMARY KEY ("tenantId","branchId")
);

-- CreateIndex
CREATE UNIQUE INDEX "geoZone_tenantId_branchId_id_key" ON "geoZone"("tenantId", "branchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "geoZone_tenantId_branchId_name_key" ON "geoZone"("tenantId", "branchId", "name");

-- CreateIndex
CREATE INDEX "geoZoneEvent_tenantId_branchId_occurredAt_idx" ON "geoZoneEvent"("tenantId", "branchId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "geoZoneEvent_tenantId_branchId_vehicleId_occurredAt_idx" ON "geoZoneEvent"("tenantId", "branchId", "vehicleId", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "geoZoneEvent_tenantId_branchId_zoneId_vehicleId_occurredAt_key" ON "geoZoneEvent"("tenantId", "branchId", "zoneId", "vehicleId", "occurredAt");

-- AddForeignKey
ALTER TABLE "geoZoneEvent" ADD CONSTRAINT "geoZoneEvent_tenantId_branchId_zoneId_fkey" FOREIGN KEY ("tenantId", "branchId", "zoneId") REFERENCES "geoZone"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "geoZoneEvent" ADD CONSTRAINT "geoZoneEvent_tenantId_branchId_vehicleId_fkey" FOREIGN KEY ("tenantId", "branchId", "vehicleId") REFERENCES "vehicle"("tenantId", "branchId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

