-- Device states walk a unit's frames by receipt time and look up their events.
CREATE INDEX "ermEvent_frameId_idx" ON "ermEvent"("frameId");
