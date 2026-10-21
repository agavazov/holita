import { setTimeout as delay } from 'node:timers/promises';
import { fleetTable, integer, rowsOf } from '../src/database/sql.js';
import { Prisma } from '../src/generated/prisma/client.js';
import type { FleetScope } from '../src/validation.js';
import type { createTestDatabase } from './test-database.js';

/** Releases a committed vehicle change only after every submitted write is waiting for it. */
export async function afterLockedVehicleChange<T>(
  database: Awaited<ReturnType<typeof createTestDatabase>>,
  scope: FleetScope,
  vehicleId: string,
  change: (transaction: Prisma.TransactionClient) => Promise<unknown>,
  requests: () => Promise<T>,
  expectedWaiters: number,
): Promise<T> {
  const submitted: { result: Promise<T> | undefined } = { result: undefined };
  try {
    await database.client.$transaction(
      async (transaction) => {
        // FOR UPDATE also holds the old implementation's foreign-key check, so the regression
        // fails on the resulting invariant rather than depending on a race or a timeout.
        const locked: unknown = await transaction.$queryRaw(Prisma.sql`
        SELECT pg_backend_pid()::int AS "pid" FROM ${fleetTable(database.schema, 'Vehicle')}
        WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
          AND "id" = ${vehicleId}::uuid FOR UPDATE`);
        const [pid] = rowsOf(locked, (row) => integer(row, 'pid'));
        if (pid === undefined) {
          throw new Error('Missing vehicle to lock for the concurrency regression.');
        }
        await change(transaction);
        submitted.result = requests();
        // The request is awaited below after the holder commits, including on holder failure.
        void submitted.result.catch(() => undefined);
        for (let attempt = 0; attempt < 250; attempt++) {
          const rows: unknown = await database.client.$queryRaw(Prisma.sql`
          WITH RECURSIVE blocked AS (
            SELECT ${pid}::int AS "pid"
            UNION
            SELECT activity."pid" FROM pg_stat_activity activity
            JOIN blocked holder ON holder."pid" = ANY(pg_blocking_pids(activity."pid"))
          ) SELECT (count(*) - 1)::int AS "waiting" FROM blocked`);
          const [waiting] = rowsOf(rows, (row) => integer(row, 'waiting'));
          if (waiting !== undefined && waiting >= expectedWaiters) {
            return;
          }
          await delay(20);
        }
        throw new Error('Submitted writes did not wait for the held Vehicle row lock.');
      },
      { timeout: 15000 },
    );
  } catch (error) {
    await submitted.result?.catch(() => undefined);
    throw error;
  }
  if (submitted.result === undefined) {
    throw new Error('No concurrency regression requests were submitted.');
  }
  return submitted.result;
}
