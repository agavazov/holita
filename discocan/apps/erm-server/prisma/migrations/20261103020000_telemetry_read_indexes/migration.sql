CREATE INDEX "ermEvent_unitId_eventTime_idx" ON "ermEvent"("unitId", "eventTime" DESC);
CREATE INDEX "ermCommand_unitId_sentAt_idx" ON "ermCommand"("unitId", "sentAt" DESC);
