import { Injectable } from '@nestjs/common';
import { fleetDataSourceDb, fleetVehicleStatusDb } from '../../database/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  boolean,
  booleanOrNull,
  date,
  dateOrNull,
  fleetTable,
  integer,
  integerOrNull,
  numberOrNull,
  databaseEnum,
  rowsOf,
  text,
  textOrNull,
} from '../../database/sql.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import { MEASUREMENT_CATALOG } from '../erm-telemetry/erm-telemetry.mapping.js';
import type { VehicleFacts } from './vehicle-state.js';
import { vehicleFactsSql } from './vehicle-facts.sql.js';

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
    status: databaseEnum(row, 'status', fleetVehicleStatusDb),
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
            source: databaseEnum(row, 'odometerSource', fleetDataSourceDb),
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

  edataMeasurements(
    scope: FleetScope,
    vehicleId: string,
    period: { from: Date; to: Date },
    parameterIds: number[] | undefined,
    take: number,
  ) {
    return this.prisma.client.vehicleEdataMeasurement.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        vehicleId,
        recordedAt: { gte: period.from, lt: period.to },
        ...(parameterIds === undefined ? {} : { parameterId: { in: parameterIds } }),
        freezeFrame: false,
      },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take,
      select: {
        id: true,
        vehicleId: true,
        deviceImei: true,
        source: true,
        recordedAt: true,
        receivedAt: true,
        parameterId: true,
        parameterType: true,
        valueSize: true,
        valueHex: true,
        name: true,
        unit: true,
      },
    });
  }

  /** Values of the vehicle's newest eData 415 freeze frame, ascending by parameter ID. */
  async latestFreezeFrame(scope: FleetScope, vehicleId: string) {
    const where = {
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      vehicleId,
      freezeFrame: true,
    };
    const latest = await this.prisma.client.vehicleEdataMeasurement.findFirst({
      where,
      orderBy: [{ recordedAt: 'desc' }, { sourceEventId: 'desc' }],
      select: { deviceImei: true, sourceEventId: true },
    });
    return latest === null
      ? []
      : this.prisma.client.vehicleEdataMeasurement.findMany({
          where: { ...where, ...latest },
          orderBy: { parameterId: 'asc' },
          select: {
            deviceImei: true,
            recordedAt: true,
            parameterId: true,
            valueHex: true,
            name: true,
            unit: true,
          },
        });
  }

  /** The newest periodic (405) value of each reported parameter, ascending by parameter ID. */
  async latestEdataValues(scope: FleetScope, vehicleId: string) {
    const rows: unknown = await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT DISTINCT ON (m."parameterId") m."parameterId"::int AS "parameterId", m."name",
        m."unit", m."recordedAt", m."valueHex"
      FROM ${fleetTable(this.prisma.schema, 'vehicleEdataMeasurement')} m
      WHERE m."tenantId" = ${scope.tenantId}::uuid AND m."branchId" = ${scope.branchId}::uuid
        AND m."vehicleId" = ${vehicleId}::uuid AND NOT m."freezeFrame"
      ORDER BY m."parameterId", m."recordedAt" DESC, m."sourceEventId" DESC, m."id" DESC`);
    return rowsOf(rows, (row) => ({
      parameterId: integer(row, 'parameterId'),
      name: textOrNull(row, 'name'),
      unit: textOrNull(row, 'unit'),
      recordedAt: date(row, 'recordedAt'),
      valueHex: text(row, 'valueHex'),
    }));
  }

  /** Monitor catalog scaling per parameter; null when its catalog rows disagree or lack one. */
  async catalogScaling(parameterIds: number[]) {
    const catalog = await this.prisma.client.edataCatalog.findFirst({
      where: MEASUREMENT_CATALOG,
      select: { id: true },
    });
    const rows =
      catalog === null
        ? []
        : await this.prisma.client.edataCatalogParameter.findMany({
            where: {
              catalogId: catalog.id,
              sourceKey: 'monitor',
              parameterId: { in: parameterIds },
            },
            select: { parameterId: true, multiply: true, offset: true },
          });
    const scaling = new Map<number, { multiply: number; offset: number } | null>();
    for (const row of rows) {
      const multiply = Number(row.multiply ?? Number.NaN);
      const offset = Number(row.offset ?? Number.NaN);
      const previous = scaling.get(row.parameterId);
      scaling.set(
        row.parameterId,
        Number.isFinite(multiply) &&
          Number.isFinite(offset) &&
          (previous === undefined ||
            (previous?.multiply === multiply && previous.offset === offset))
          ? { multiply, offset }
          : null,
      );
    }
    return scaling;
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
   * Serializes readings with Vehicle updates/deactivation. Explicit READ COMMITTED lets the
   * latest-reading check see a reading committed while this transaction waited for the lock.
   */
  insertManualReading(
    scope: FleetScope,
    data: { vehicleId: string; odometerKm: number; recordedAt: Date; receivedAt: Date },
    check: (latest: OdometerReading | null) => void,
  ): Promise<SampleRow | null> {
    return this.prisma.client.$transaction(
      async (transaction) => {
        const locked: unknown = await transaction.$queryRaw(Prisma.sql`
        SELECT v."id"::text AS "id" FROM ${fleetTable(this.prisma.schema, 'vehicle')} v
        WHERE v."tenantId" = ${scope.tenantId}::uuid AND v."branchId" = ${scope.branchId}::uuid
          AND v."id" = ${data.vehicleId}::uuid AND v."status"::text <> 'inactive'
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
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }
}
