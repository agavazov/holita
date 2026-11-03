-- CreateTable
CREATE TABLE "ermUpstreamClose" (
    "id" BIGSERIAL NOT NULL,
    "connectionId" UUID NOT NULL,
    "closedAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "ermUpstreamClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ermUpstreamClose_connectionId_closedAt_idx" ON "ermUpstreamClose"("connectionId", "closedAt" DESC);

-- AddForeignKey
ALTER TABLE "ermUpstreamClose" ADD CONSTRAINT "ermUpstreamClose_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ermConnection"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
