-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ermDirection" AS ENUM ('device', 'upstream');

-- CreateEnum
CREATE TYPE "ermChecksum" AS ENUM ('ok', 'mismatch', 'absent');

-- CreateTable
CREATE TABLE "ermConnection" (
    "id" UUID NOT NULL,
    "peer" TEXT NOT NULL,
    "unitId" VARCHAR(15),
    "upstream" TEXT NOT NULL,
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forwardedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "closeReason" TEXT,
    "deviceBytes" BIGINT NOT NULL DEFAULT 0,
    "serverBytes" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "ermConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ermFrame" (
    "id" BIGSERIAL NOT NULL,
    "connectionId" UUID NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "direction" "ermDirection" NOT NULL,
    "unitId" VARCHAR(15),
    "command" VARCHAR(3),
    "reference" VARCHAR(9),
    "checksum" "ermChecksum" NOT NULL,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "raw" BYTEA NOT NULL,

    CONSTRAINT "ermFrame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ermFrame_unitId_receivedAt_idx" ON "ermFrame"("unitId", "receivedAt" DESC);

-- AddForeignKey
ALTER TABLE "ermFrame" ADD CONSTRAINT "ermFrame_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ermConnection"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
