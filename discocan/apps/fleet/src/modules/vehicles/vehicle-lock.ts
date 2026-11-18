import { fleetVehicleStatusDb } from '../../database/enums.js';
import { fleetTable, databaseEnum, rowsOf, textOrNull } from '../../database/sql.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetVehicleStatus } from '../../generated/prisma/enums.js';
import type { FleetScope } from '../../validation.js';

/** Serialize scoped Vehicle state checks with assignment, deactivation and service writes. */
export async function lockVehicleState(
  transaction: Prisma.TransactionClient,
  schema: string,
  scope: FleetScope,
  id: string,
): Promise<{ status: FleetVehicleStatus; currentDriverId: string | null } | null> {
  const locked: unknown = await transaction.$queryRaw(Prisma.sql`
    SELECT "status"::text AS "status", "currentDriverId"::text AS "currentDriverId"
    FROM ${fleetTable(schema, 'vehicle')}
    WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
      AND "id" = ${id}::uuid FOR NO KEY UPDATE`);
  return (
    rowsOf(locked, (row) => ({
      status: databaseEnum(row, 'status', fleetVehicleStatusDb),
      currentDriverId: textOrNull(row, 'currentDriverId'),
    }))[0] ?? null
  );
}
