import 'dotenv/config';
import { createPrismaClient } from './database/client.js';
import { redecodeFrames } from './modules/devices/redecode.js';
import { DEFAULT_EVENT_STRUCTURE } from './starlink/index.js';

async function redecode(): Promise<void> {
  const startedAt = new Date();
  const eventStructure = (process.env.ERM_EVENT_STRUCTURE ?? DEFAULT_EVENT_STRUCTURE)
    .split(',')
    .map((token) => token.trim());
  const client = createPrismaClient();
  try {
    const summary = await redecodeFrames(client, eventStructure, startedAt);
    console.info(
      `Frames scanned: ${String(summary.framesScanned)}; events updated: ${String(summary.eventsUpdated)}; events inserted: ${String(summary.eventsInserted)}; surplus events: ${String(summary.surplusEvents)}; decode failures: ${String(summary.decodeFailures)}.`,
    );
  } finally {
    await client.$disconnect();
  }
}

redecode().catch(() => {
  console.error('ERM re-decode failed; check its configuration and database connection.');
  process.exitCode = 1;
});
