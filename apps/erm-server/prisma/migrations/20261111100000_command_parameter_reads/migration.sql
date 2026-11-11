-- Operator reads of selected tracker parameters (03/45). Existing requests keep an empty list.
ALTER TYPE "ermDeviceAction" ADD VALUE 'readParameters';

ALTER TABLE "ermCommandRequest"
  ADD COLUMN "parameters" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
