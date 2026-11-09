-- CreateEnum
CREATE TYPE "ermCommandStatus" AS ENUM ('sent', 'answered', 'timeout', 'failed');

-- AlterEnum
ALTER TYPE "ermDirection" ADD VALUE 'discocan';

-- CreateTable
CREATE TABLE "ermCommand" (
    "id" UUID NOT NULL,
    "unitId" VARCHAR(15) NOT NULL,
    "connectionId" UUID NOT NULL,
    "reference" VARCHAR(9) NOT NULL,
    "command" VARCHAR(3) NOT NULL,
    "fields" TEXT[],
    "status" "ermCommandStatus" NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMPTZ(3) NOT NULL,
    "answeredAt" TIMESTAMPTZ(3),
    "resultCode" TEXT,
    "response" BYTEA,

    CONSTRAINT "ermCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ermEvent" (
    "id" BIGSERIAL NOT NULL,
    "frameId" BIGINT NOT NULL,
    "unitId" VARCHAR(15) NOT NULL,
    "eventId" VARCHAR(3),
    "eventTime" TIMESTAMPTZ(3),
    "positionTime" TIMESTAMPTZ(3),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "speedKmh" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "odometer" DOUBLE PRECISION,
    "engineOn" BOOLEAN,
    "mainVoltage" DOUBLE PRECISION,
    "backupVoltage" DOUBLE PRECISION,
    "fields" JSONB NOT NULL,

    CONSTRAINT "ermEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ermCommand" ADD CONSTRAINT "ermCommand_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ermConnection"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ermEvent" ADD CONSTRAINT "ermEvent_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "ermFrame"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

