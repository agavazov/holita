import { Injectable } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma, VehicleStatusSample } from '../../generated/prisma/client.js';
import type { DeviceReportPage } from '@discocan/device-contract';
import type { FleetDeviceType } from '../../generated/prisma/enums.js';
import { DeviceAdapters } from '../../integrations/device-adapters.js';
import type { FleetScope } from '../../validation.js';
import {
  deviceEvents,
  deviceSamples,
  deviceMeasurements,
  MEASUREMENT_CATALOG,
  type TelemetryDevice,
} from './device-telemetry.mapping.js';
import {
  recordedDiagnosticNotifications,
  withoutRepeatedFaults,
} from '../notifications/notification-projection.js';
import {
  notificationCutoff,
  notificationSourceKey,
} from '../notifications/notification-sources.repository.js';
import { warningLampNotifications } from '../notifications/warning-lamp-notifications.js';
import { WARNING_LAMP_PARAMETER_IDS } from '../devices/warning-lamps.js';

@Injectable()
export class DeviceTelemetryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: FleetClock,
    private readonly adapters: DeviceAdapters,
  ) {}

  devices(types: FleetDeviceType[]) {
    // Deliberate background registry read across all Tenant/Branch scopes; page writes are scoped.
    return this.prisma.client.device.findMany({
      where: { type: { in: types } },
      select: {
        id: true,
        type: true,
        tenantId: true,
        branchId: true,
        imei: true,
        vehicleId: true,
        installedAt: true,
        createdAt: true,
        cursor: { select: { lastEventId: true } },
      },
    });
  }

  async importPage(device: TelemetryDevice, page: DeviceReportPage): Promise<void> {
    const scope = { tenantId: device.tenantId, branchId: device.branchId };
    const now = this.clock.now();
    await this.prisma.client.$transaction(
      async (transaction) => {
        const data = deviceSamples(device, page.reports);
        if (device.vehicleId !== null && data.length > 0) {
          const pair = { ...scope, vehicleId: device.vehicleId, deviceImei: device.imei };
          const latest = await transaction.vehicleStatusSample.findFirst({
            where: { ...pair, source: device.type },
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
            device.type,
            samples,
            latest?.recordedAt ?? null,
          );
        }
        const events = deviceEvents(device, page.reports);
        if (events.length > 0) {
          await transaction.fleetEvent.createMany({ data: events, skipDuplicates: true });
        }
        const settings = await transaction.fleetSettings.findUnique({
          where: { tenantId_branchId: scope },
          select: { notificationRetentionDays: true },
        });
        const cutoff = notificationCutoff(now, settings?.notificationRetentionDays ?? 7);
        const sourceKey = notificationSourceKey(device);
        const notificationCursor = await transaction.fleetNotificationCursor.upsert({
          where: { tenantId_branchId_sourceKey: { ...scope, sourceKey } },
          create: {
            ...scope,
            sourceKey,
            since: device.createdAt > cutoff ? device.createdAt : cutoff,
          },
          update: {},
        });
        const notifications = await withoutRepeatedFaults(
          transaction,
          recordedDiagnosticNotifications(
            device,
            page.reports,
            notificationCursor.since > cutoff ? notificationCursor.since : cutoff,
            now,
          ),
        );
        if (notifications.length) {
          await transaction.fleetNotification.createMany({
            data: notifications,
            skipDuplicates: true,
          });
        }
        if (this.adapters.enabled(device.type, 'measurements')) {
          const parameterIds = [
            ...new Set(
              page.reports.flatMap((report) => report.measurements.map((item) => item.parameterId)),
            ),
          ];
          if (device.vehicleId !== null && parameterIds.length > 0) {
            const labels = await this.measurementLabels(transaction, parameterIds);
            const measurements = deviceMeasurements(device, page.reports, labels);
            if (measurements.length > 0) {
              const previousLamps = await transaction.vehicleEdataMeasurement.findMany({
                where: {
                  ...scope,
                  vehicleId: device.vehicleId,
                  deviceImei: device.imei,
                  parameterId: { in: [...WARNING_LAMP_PARAMETER_IDS] },
                  freezeFrame: false,
                },
                distinct: ['parameterId'],
                orderBy: [
                  { parameterId: 'asc' },
                  { recordedAt: 'desc' },
                  { receivedAt: 'desc' },
                  { sourceEventId: 'desc' },
                  { id: 'desc' },
                ],
              });
              const inserted = await transaction.vehicleEdataMeasurement.createManyAndReturn({
                data: measurements,
                skipDuplicates: true,
              });
              const lampNotifications = warningLampNotifications(
                device,
                previousLamps,
                inserted.filter((row) => !row.freezeFrame),
                notificationCursor.since > cutoff ? notificationCursor.since : cutoff,
                now,
              );
              if (lampNotifications.length) {
                await transaction.fleetNotification.createMany({
                  data: lampNotifications,
                  skipDuplicates: true,
                });
              }
            }
          }
        }
        const cursor = await transaction.deviceCursor.findUnique({
          where: { ...scope, deviceId: device.id },
          select: { lastReceivedAt: true },
        });
        const lastReceivedAt = page.reports.reduce<Date | null>(
          (latest, event) =>
            latest === null || event.receivedAt > latest ? event.receivedAt : latest,
          cursor?.lastReceivedAt ?? null,
        );
        await transaction.deviceCursor.upsert({
          where: { ...scope, deviceId: device.id },
          create: { ...scope, deviceId: device.id, lastEventId: page.next, lastReceivedAt },
          update: { lastEventId: page.next, lastReceivedAt },
        });
        // A full 500-event backlog page took 6–10 s on 2026-11-18; Prisma's default is 5 s.
      },
      { timeout: 60_000 },
    );
  }

  private async measurementLabels(transaction: Prisma.TransactionClient, parameterIds: number[]) {
    const catalog = await transaction.edataCatalog.findFirst({
      where: MEASUREMENT_CATALOG,
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
    source: FleetDeviceType,
    samples: VehicleStatusSample[],
    latestBeforePage: Date | null,
  ): Promise<void> {
    const newer = samples
      .filter((sample) => latestBeforePage === null || sample.recordedAt > latestBeforePage)
      .sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime());
    if (newer.length === 0) {
      return;
    }
    const pair = { ...scope, vehicleId, deviceImei, source };
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
