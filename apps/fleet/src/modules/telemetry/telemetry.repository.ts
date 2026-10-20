import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  boolean,
  booleanOrNull,
  date,
  dateOrNull,
  fleetTable,
  integerOrNull,
  numberOrNull,
  oneOf,
  rowsOf,
  text,
  textOrNull,
} from '../../database/sql.js';
import { Prisma } from '../../generated/prisma/client.js';
import { FleetDataSource, FleetVehicleStatus } from '../../generated/prisma/enums.js';
import type { FleetScope } from '../../validation.js';
import type { VehicleFacts } from './vehicle-state.js';
import { vehicleFactsSql } from './vehicle-facts.sql.js';

const VEHICLE_STATUSES = Object.values(FleetVehicleStatus);
const DATA_SOURCES = Object.values(FleetDataSource);

export const sampleSelect = {
  id: true,
  vehicleId: true,
  deviceImei: true,
  source: true,
  recordedAt: true,
  receivedAt: true,
  latitude: true,
  longitude: true,
  address: true,
  speedKph: true,
  headingDeg: true,
  ignition: true,
  odometerKm: true,
  fuelLevelPct: true,
  externalVoltage: true,
  backupBatteryVoltage: true,
  engineHours: true,
  coolantTempC: true,
} satisfies Prisma.VehicleStatusSampleSelect;

export type SampleRow = Prisma.VehicleStatusSampleGetPayload<{ select: typeof sampleSelect }>;

const odometerSelect = {
  odometerKm: true,
  recordedAt: true,
} satisfies Prisma.VehicleStatusSampleSelect;

export type OdometerReading = Prisma.VehicleStatusSampleGetPayload<{
  select: typeof odometerSelect;
}>;

function latestOdometer(
  client: Prisma.TransactionClient,
  scope: FleetScope,
  vehicleId: string,
): Promise<OdometerReading | null> {
  return client.vehicleStatusSample.findFirst({
    where: {
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      vehicleId,
      odometerKm: { not: null },
    },
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    select: odometerSelect,
  });
}

export function parseVehicleFacts(row: Record<string, unknown>): VehicleFacts {
  const recordedAt = dateOrNull(row, 'sampleRecordedAt');
  const odometerKm = numberOrNull(row, 'odometerKm');
  return {
    vehicleId: text(row, 'id'),
    status: oneOf(row, 'status', VEHICLE_STATUSES),
    hasDevice: boolean(row, 'hasDevice'),
    latest:
      recordedAt === null
        ? null
        : {
            recordedAt,
            latitude: numberOrNull(row, 'latitude'),
            longitude: numberOrNull(row, 'longitude'),
            address: textOrNull(row, 'address'),
            speedKph: numberOrNull(row, 'speedKph'),
            headingDeg: integerOrNull(row, 'headingDeg'),
            ignition: booleanOrNull(row, 'ignition'),
            fuelLevelPct: numberOrNull(row, 'fuelLevelPct'),
            externalVoltage: numberOrNull(row, 'externalVoltage'),
            backupBatteryVoltage: numberOrNull(row, 'backupBatteryVoltage'),
            engineHours: numberOrNull(row, 'engineHours'),
            coolantTempC: integerOrNull(row, 'coolantTempC'),
          },
    odometer:
      odometerKm === null
        ? null
        : {
            odometerKm,
            recordedAt: date(row, 'odometerRecordedAt'),
            source: oneOf(row, 'odometerSource', DATA_SOURCES),
          },
  };
}

@Injectable()
export class TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Data clock: the latest device-reported sample time of the Branch (MANUAL rows excluded). */
  async asOf(scope: FleetScope): Promise<Date | null> {
    const result = await this.prisma.client.vehicleStatusSample.aggregate({
      where: { tenantId: scope.tenantId, branchId: scope.branchId, deviceImei: { not: null } },
      _max: { recordedAt: true },
    });
    return result._max.recordedAt;
  }

  /**
   * Per vehicle: status, whether it has a device, its latest device sample and its latest
   * non-null odometer of any source (one scoped query for the whole page).
   */
  async vehicleFacts(scope: FleetScope, ids: readonly string[]): Promise<VehicleFacts[]> {
    if (!ids.length) {
      return [];
    }
    const rows: unknown = await this.prisma.client.$queryRaw(
      vehicleFactsSql(this.prisma.schema, scope, ids),
    );
    return rowsOf(rows, parseVehicleFacts);
  }

  /** `max(recordedAt)` per (vehicle, IMEI) pair; pairs that never reported are absent. */
  async lastReported(
    scope: FleetScope,
    pairs: readonly { vehicleId: string; imei: string }[],
  ): Promise<{ vehicleId: string; imei: string; recordedAt: Date }[]> {
    if (!pairs.length) {
      return [];
    }
    const rows = await this.prisma.client.vehicleStatusSample.groupBy({
      by: ['vehicleId', 'deviceImei'],
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        OR: pairs.map((pair) => ({ vehicleId: pair.vehicleId, deviceImei: pair.imei })),
      },
      _max: { recordedAt: true },
    });
    return rows.flatMap((row) =>
      row.deviceImei === null || row._max.recordedAt === null
        ? []
        : [{ vehicleId: row.vehicleId, imei: row.deviceImei, recordedAt: row._max.recordedAt }],
    );
  }

  /** The newest `take` samples of any source in `[from, to)`, newest first. */
  samples(
    scope: FleetScope,
    vehicleId: string,
    period: { from: Date; to: Date },
    take: number,
  ): Promise<SampleRow[]> {
    return this.prisma.client.vehicleStatusSample.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        vehicleId,
        recordedAt: { gte: period.from, lt: period.to },
      },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take,
      select: sampleSelect,
    });
  }

  findVehicle(scope: FleetScope, id: string) {
    return this.prisma.client.vehicle.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      select: { id: true, status: true },
    });
  }

  /** Latest non-null odometer reading of the vehicle from any source. */
  latestOdometerReading(scope: FleetScope, vehicleId: string) {
    return latestOdometer(this.prisma.client, scope, vehicleId);
  }

  /**
   * Serializes readings with Vehicle updates/deactivation. Default READ COMMITTED lets the
   * latest-reading check see a reading committed while this transaction waited for the lock.
   */
  insertManualReading(
    scope: FleetScope,
    data: { vehicleId: string; odometerKm: number; recordedAt: Date; receivedAt: Date },
    check: (latest: OdometerReading | null) => void,
  ): Promise<SampleRow | null> {
    return this.prisma.client.$transaction(async (transaction) => {
      const locked: unknown = await transaction.$queryRaw(Prisma.sql`
        SELECT v."id"::text AS "id" FROM ${fleetTable(this.prisma.schema, 'Vehicle')} v
        WHERE v."tenantId" = ${scope.tenantId}::uuid AND v."branchId" = ${scope.branchId}::uuid
          AND v."id" = ${data.vehicleId}::uuid AND v."status"::text <> 'INACTIVE'
        FOR NO KEY UPDATE`);
      if (!rowsOf(locked, (row) => text(row, 'id')).length) {
        return null;
      }
      check(await latestOdometer(transaction, scope, data.vehicleId));
      return transaction.vehicleStatusSample.create({
        data: {
          ...data,
          tenantId: scope.tenantId,
          branchId: scope.branchId,
          source: 'MANUAL',
          deviceImei: null,
        },
        select: sampleSelect,
      });
    });
  }
}
