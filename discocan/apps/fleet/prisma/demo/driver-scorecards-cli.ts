import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { issueDemoToken } from '../../src/auth/demo-auth.js';
import { createPrismaClient } from '../../src/database/client.js';
import { getDatabaseUrl } from '../../src/database/connection.js';
import { CoreClient } from '../../src/integrations/core/core.client.js';
import { DEMO_BRANCH_ID, DEMO_TENANT_ID } from './catalog.js';
import { demoOptions } from './config.js';
import { seedDriverScorecards } from './driver-scorecards.js';

async function run(): Promise<void> {
  if (process.argv.length > 2) {
    throw new Error('Fleet demo scorecards accept no arguments.');
  }
  const options = demoOptions(
    [],
    {
      nodeEnv: process.env.NODE_ENV,
      databaseUrl: getDatabaseUrl(),
      coreUrl: process.env.CORE_GRAPHQL_URL ?? 'http://127.0.0.1:11011/graphql',
    },
    Date.now(),
  );
  await new CoreClient().requireBranch(DEMO_BRANCH_ID, {
    tenantId: DEMO_TENANT_ID,
    branchId: DEMO_BRANCH_ID,
    requestId: randomUUID(),
    authorization: `Bearer ${issueDemoToken(DEMO_TENANT_ID)}`,
    branchChecks: new Map(),
  });
  const client = createPrismaClient(options.connectionString, options.schema);
  try {
    const result = await seedDriverScorecards(client);
    console.info(
      `fleet demo scorecards: drivers=${String(result.drivers)}, trips=${String(result.trips)}, events=${String(result.events)}; existing rows preserved; data clock=${result.anchor.toISOString()}`,
    );
  } finally {
    await client.$disconnect();
  }
}

try {
  await run();
} catch (error: unknown) {
  console.error(
    error instanceof Error && /^Fleet demo/.test(error.message)
      ? error.message
      : 'Fleet demo scorecard seed failed. Verify local Core access and database configuration.',
  );
  process.exitCode = 1;
}
