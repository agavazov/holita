import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { issueDemoToken } from '../../src/auth/demo-auth.js';
import { createPrismaClient } from '../../src/database/client.js';
import { getDatabaseUrl } from '../../src/database/connection.js';
import { CoreClient } from '../../src/integrations/core/core.client.js';
import { seedFleet } from '../seed-data.js';
import { DEMO_BRANCH_ID, DEMO_TENANT_ID } from './catalog.js';
import { demoOptions } from './config.js';
import { seedFleetDemo } from './seed-demo.js';

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.info(
      'Fleet demo: tsx prisma/demo/cli.ts [--as-of=2026-10-18T06:30:00.000Z]; inserts missing synthetic Discordia records only.',
    );
    return;
  }
  const options = demoOptions(
    args,
    {
      nodeEnv: process.env.NODE_ENV,
      databaseUrl: getDatabaseUrl(),
      coreUrl: process.env.CORE_GRAPHQL_URL ?? 'http://127.0.0.1:11011/graphql',
    },
    Date.now(),
  );
  // The generated Core contract verifies this tenant's Branch before either seed writes.
  await new CoreClient().requireBranch(DEMO_BRANCH_ID, {
    tenantId: DEMO_TENANT_ID,
    branchId: DEMO_BRANCH_ID,
    requestId: randomUUID(),
    authorization: `Bearer ${issueDemoToken(DEMO_TENANT_ID)}`,
    branchChecks: new Map(),
  });
  const client = createPrismaClient(options.connectionString, options.schema);
  try {
    const minimal = await seedFleet(client);
    const result = await seedFleetDemo(client, { anchor: options.anchor, schema: options.schema });
    const counts: readonly (readonly [string, number])[] = [
      ['groups', result.groups],
      ['drivers', result.drivers],
      ['vehicles', result.vehicles],
      ['devices', result.devices],
      ['serviceTasks', result.serviceTasks],
      ['samples', result.samples],
      ['trips', result.trips],
      ['events', result.events],
    ];
    console.info(
      `fleet foundation: inserted ${String(minimal.vehicles)} vehicles and ${String(minimal.devices)} devices`,
    );
    console.info(
      `fleet demo: ${counts
        .map(([table, count]) => `${table}=${String(count)}`)
        .join(', ')}; existing rows preserved`,
    );
  } finally {
    await client.$disconnect();
  }
}

try {
  await run();
} catch (error: unknown) {
  // Database URLs and unexpected adapter diagnostics may contain credentials; do not echo them.
  console.error(
    error instanceof Error && /^(Fleet demo|Demo seed conflict:)/.test(error.message)
      ? error.message
      : 'Fleet demo seed failed. Verify local Core access, migrations and database configuration.',
  );
  process.exitCode = 1;
}
