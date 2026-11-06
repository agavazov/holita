-- AlterTable
ALTER TABLE "ermCommandRequest" ADD COLUMN "batchId" UUID,
ADD COLUMN "batchIndex" INTEGER,
ADD COLUMN "cancelledByActorId" VARCHAR(128),
ADD COLUMN "retryOfId" UUID,
ADD COLUMN "waitingReason" VARCHAR(64),
ADD COLUMN "waitingSince" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "ermCommandBatch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "actorId" VARCHAR(128) NOT NULL,
    "action" "ermDeviceAction" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "stoppedAt" TIMESTAMPTZ(3),
    "stoppedByActorId" VARCHAR(128),
    CONSTRAINT "ermCommandBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ermCommandBatch_tenantId_branchId_id_key" ON "ermCommandBatch"("tenantId", "branchId", "id");
CREATE INDEX "ermCommandRequest_tenantId_branchId_createdAt_id_idx" ON "ermCommandRequest"("tenantId", "branchId", "createdAt" DESC, "id" DESC);
CREATE UNIQUE INDEX "ermCommandRequest_tenantId_branchId_id_key" ON "ermCommandRequest"("tenantId", "branchId", "id");
CREATE UNIQUE INDEX "ermCommandRequest_batchId_batchIndex_key" ON "ermCommandRequest"("batchId", "batchIndex");

-- AddForeignKey
ALTER TABLE "ermCommandRequest" ADD CONSTRAINT "ermCommandRequest_tenantId_branchId_retryOfId_fkey" FOREIGN KEY ("tenantId", "branchId", "retryOfId") REFERENCES "ermCommandRequest"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ermCommandRequest" ADD CONSTRAINT "ermCommandRequest_tenantId_branchId_batchId_fkey" FOREIGN KEY ("tenantId", "branchId", "batchId") REFERENCES "ermCommandBatch"("tenantId", "branchId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Batch positions and waiting observations are recorded as pairs.
ALTER TABLE "ermCommandRequest"
  ADD CONSTRAINT "ermCommandRequest_batch_position_check" CHECK (
    ("batchId" IS NULL AND "batchIndex" IS NULL)
    OR ("batchId" IS NOT NULL AND "batchIndex" IS NOT NULL AND "batchIndex" >= 0)
  ),
  ADD CONSTRAINT "ermCommandRequest_waiting_reason_check" CHECK (
    ("waitingReason" IS NULL AND "waitingSince" IS NULL)
    OR ("waitingReason" IN ('GATEWAY_UNAVAILABLE', 'FLEET_VERIFICATION_UNAVAILABLE', 'UNIT_NOT_CONNECTED')
      AND "waitingReason" IS NOT NULL AND "waitingSince" IS NOT NULL)
  );
