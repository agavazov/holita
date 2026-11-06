import { Injectable } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma, VehicleStatusSample } from '../../generated/prisma/client.js';
import type { ErmTelemetryPage } from '../../integrations/erm/erm-telemetry.client.js';
import type { FleetScope } from '../../validation.js';
import {
  ermFleetEvents,
  ermSamples,
  ermEdataMeasurements,
  ermEdataMeasurementsEnabled,
  type ErmTelemetryDevice,
} from './erm-telemetry.mapping.js';
import { recordedDiagnosticNotifications } from '../notifications/notification-projection.js';
import { notificationCutoff } from '../notifications/notification-sources.repository.js';

@Injectable()
export class ErmTelemetryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: FleetClock,
  ) {}

  devices() {
    // Deliberate background registry read across all Tenant/Branch scopes; page writes are scoped.
    return this.prisma.client.device.findMany({
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        imei: true,
        vehicleId: true,
        installedAt: true,
        createdAt: true,
        ermCursor: { select: { lastEventId: true } },
      },
    });
  }

  async importPage(device: ErmTelemetryDevice, page: ErmTelemetryPage): Promise<void> {
    const scope = { tenantId: device.tenantId, branchId: device.branchId };
    const now = this.clock.now();
    await this.prisma.client.$transaction(async (transaction) => {
      const data = ermSamples(device, page.events);
      if (device.vehicleId !== null && data.length > 0) {
        const pair = { ...scope, vehicleId: device.vehicleId, deviceImei: device.imei };
        const latest = await transaction.vehicleStatusSample.findFirst({
          where: { ...pair, source: 'ERM' },
          orderBy: { recordedAt: 'desc' },
          select: { recordedAt: true },
        });
        const samples = await transaction.vehicleStatusSample.createManyAndReturn({
          data,
          skipDuplicates: true,
        });
        await this.updateTrips(
          transaction,
          scope,
          device.vehicleId,
          device.imei,
          samples,
          latest?.recordedAt ?? null,
        );
      }
      const events = ermFleetEvents(device, page.events);
      if (events.length > 0) {
        await transaction.fleetEvent.createMany({ data: events, skipDuplicates: true });
      }
      const settings = await transaction.fleetSettings.findUnique({
        where: { tenantId_branchId: scope },
        select: { notificationRetentionDays: true },
      });
      const cutoff = notificationCutoff(now, settings?.notificationRetentionDays ?? 7);
      const sourceKey = `erm:${device.id}`;
      const notificationCursor = await transaction.fleetNotificationCursor.upsert({
        where: { tenantId_branchId_sourceKey: { ...scope, sourceKey } },
        create: {
          ...scope,
          sourceKey,
          since: device.createdAt > cutoff ? device.createdAt : cutoff,
        },
        update: {},
      });
      const notifications = recordedDiagnosticNotifications(
        device,
        page.events,
        notificationCursor.since > cutoff ? notificationCursor.since : cutoff,
        now,
      );
      if (notifications.length) {
        await transaction.fleetNotification.createMany({
          data: notifications,
          skipDuplicates: true,
        });
      }
      if (ermEdataMeasurementsEnabled()) {
        const parameterIds = [
          ...new Set(
            page.events.flatMap((event) =>
              event.edata?.report === '405'
                ? event.edata.measurements.map((item) => item.parameterId)
                : [],
            ),
          ),
        ];
        if (device.vehicleId !== null && parameterIds.length > 0) {
          const labels = await this.measurementLabels(transaction, parameterIds);
          const measurements = ermEdataMeasurements(device, page.events, labels);
          if (measurements.length > 0) {
            await transaction.vehicleEdataMeasurement.createMany({
              data: measurements,
              skipDuplicates: true,
            });
          }
        }
      }
      const cursor = await transaction.fleetErmCursor.findUnique({
        where: { ...scope, deviceId: device.id },
        select: { lastReceivedAt: true },
      });
      const lastReceivedAt = page.events.reduce<Date | null>(
        (latest, event) =>
          latest === null || event.receivedAt > latest ? event.receivedAt : latest,
        cursor?.lastReceivedAt ?? null,
      );
      await transaction.fleetErmCursor.upsert({
        where: { ...scope, deviceId: device.id },
        create: { ...scope, deviceId: device.id, lastEventId: page.next, lastReceivedAt },
        update: { lastEventId: page.next, lastReceivedAt },
      });
    });
  }

  private async measurementLabels(transaction: Prisma.TransactionClient, parameterIds: number[]) {
    const catalog = await transaction.edataCatalog.findFirst({
      where: {
        sourceSha256: '01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0',
        extractorVersion: '1.0.0',
        schemaVersion: 1,
      },
      select: { id: true },
    });
    const rows =
      catalog === null
        ? []
        : await transaction.edataCatalogParameter.findMany({
            where: {
              catalogId: catalog.id,
              sourceKey: 'monitor',
              parameterId: { in: parameterIds },
            },
            select: { parameterId: true, name: true },
          });
    const names = new Map<number, Set<string>>();
    for (const row of rows) {
      const candidates = names.get(row.parameterId) ?? new Set<string>();
      candidates.add(row.name);
      names.set(row.parameterId, candidates);
    }
    const units = new Set([
      '%',
      'RPM',
      'rpm',
      'kph',
      'km/h',
      'km',
      'meters',
      'mm',
      'L',
      'L/h',
      'kg',
      'kg/h',
      'g',
      'g/l',
      'c',
      'F',
      'V',
      'v',
      'A',
      'bar',
      'kPa',
      'kpa',
      'MPa',
      'Nm',
      'kw',
      'kWh',
      'KWh',
      'kwh',
      'Wh',
      'kWh/100km',
      'watt/hour',
      'seconds',
      'sec',
      'ms',
      'minutes',
    ]);
    return new Map(
      parameterIds.map((parameterId) => {
        const candidates = names.get(parameterId);
        const name = candidates?.size === 1 ? ([...candidates][0] ?? null) : null;
        const suffix = name === null ? undefined : /\(([^()]*)\)$/.exec(name)?.[1];
        return [parameterId, { name, unit: suffix && units.has(suffix) ? suffix : null }];
      }),
    );
  }

  private async updateTrips(
    transaction: Prisma.TransactionClient,
    scope: FleetScope,
    vehicleId: string,
    deviceImei: string,
    samples: VehicleStatusSample[],
    latestBeforePage: Date | null,
  ): Promise<void> {
    const newer = samples
      .filter((sample) => latestBeforePage === null || sample.recordedAt > latestBeforePage)
      .sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime());
    if (newer.length === 0) {
      return;
    }
    const pair = { ...scope, vehicleId, deviceImei, source: 'ERM' as const };
    let trip = await transaction.trip.findFirst({
      where: { ...pair, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    let maxSpeedKph = trip?.maxSpeedKph ?? null;
    for (const sample of newer) {
      if (trip === null && sample.ignition === true) {
        trip = await transaction.trip.create({
          data: {
            ...pair,
            startedAt: sample.recordedAt,
            startLatitude: sample.latitude,
            startLongitude: sample.longitude,
            startOdometerKm: sample.odometerKm,
            maxSpeedKph: sample.speedKph,
          },
        });
        maxSpeedKph = trip.maxSpeedKph;
      }
      if (trip === null) {
        continue;
      }
      if (sample.speedKph !== null) {
        maxSpeedKph = Math.max(maxSpeedKph ?? sample.speedKph, sample.speedKph);
      }
      if (sample.ignition === false) {
        const endOdometerKm =
          sample.odometerKm !== null &&
          trip.startOdometerKm !== null &&
          sample.odometerKm < trip.startOdometerKm
            ? null
            : sample.odometerKm;
        const distance =
          endOdometerKm !== null && trip.startOdometerKm !== null
            ? endOdometerKm - trip.startOdometerKm
            : null;
        await transaction.trip.updateMany({
          where: { ...pair, id: trip.id },
          data: {
            endedAt: sample.recordedAt,
            endLatitude: sample.latitude,
            endLongitude: sample.longitude,
            endOdometerKm,
            distanceKm: distance !== null && distance >= 0 && distance <= 5_000 ? distance : null,
            maxSpeedKph,
          },
        });
        trip = null;
        maxSpeedKph = null;
      }
    }
    if (trip !== null) {
      await transaction.trip.updateMany({
        where: { ...pair, id: trip.id },
        data: { maxSpeedKph },
      });
    }
  }
}
