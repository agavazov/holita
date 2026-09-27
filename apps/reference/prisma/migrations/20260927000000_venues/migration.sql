CREATE TABLE "Venue" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "city" VARCHAR(120) NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "address" VARCHAR(300),
    "capacity" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Venue_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0)
);

CREATE INDEX "Venue_storeId_createdAt_id_idx" ON "Venue"("storeId", "createdAt", "id");
