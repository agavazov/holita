import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { FleetClock } from '../../clock/fleet-clock.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { SettingsService } from '../settings/settings.service.js';
import { defaultFleetSettings } from '../settings/settings-defaults.js';
import { type SampleRow, TelemetryRepository } from './telemetry.repository.js';
import { MAX_SERIES_SAMPLES, TelemetryService } from './telemetry.service.js';

async function fieldErrors(action: Promise<unknown>): Promise<unknown> {
  try {
    await action;
  } catch (error) {
    if (!(error instanceof BadRequestException)) {
      throw error;
    }
    const response = error.getResponse();
    return typeof response === 'object' && 'fieldErrors' in response
      ? response.fieldErrors
      : undefined;
  }
  throw new Error('Expected BAD_USER_INPUT');
}

describe('Telemetry clocks, samples and odometer readings', () => {
  const asOf = jest.fn<TelemetryRepository['asOf']>();
  const findVehicle = jest.fn<TelemetryRepository['findVehicle']>();
  const samples = jest.fn<TelemetryRepository['samples']>();
  const latestOdometerReading = jest.fn<TelemetryRepository['latestOdometerReading']>();
  const insertManualReading = jest.fn<TelemetryRepository['insertManualReading']>();
  const vehicleFacts = jest.fn<TelemetryRepository['vehicleFacts']>();
  const requireBranch = jest.fn<CoreClient['requireBranch']>();
  // 22:30 UTC on 17 October is the business date 18 October in Europe/Sofia.
  const now = new Date('2026-10-17T22:30:00.000Z');
  const dataClock = new Date('2026-10-17T21:00:00.000Z');
  const context = {
    requestId: randomUUID(),
    tenantId: '01000000-0000-4000-8000-000000000001',
    branchId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map(),
  };
  const scope = { tenantId: context.tenantId, branchId: context.branchId };
  const vehicleId = randomUUID();
  function sample(overrides: Partial<SampleRow> = {}): SampleRow {
    return {
      id: randomUUID(),
      vehicleId,
      deviceImei: null,
      source: 'MANUAL',
      recordedAt: dataClock,
      receivedAt: now,
      latitude: null,
      longitude: null,
      address: null,
      speedKph: null,
      headingDeg: null,
      ignition: null,
      odometerKm: 1000,
      fuelLevelPct: null,
      externalVoltage: null,
      backupBatteryVoltage: null,
      engineHours: null,
      coolantTempC: null,
      ...overrides,
    };
  }
  let service: TelemetryService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TelemetryService,
        {
          provide: SettingsService,
          useValue: { read: () => Promise.resolve(defaultFleetSettings()) },
        },
        {
          provide: TelemetryRepository,
          useValue: {
            asOf,
            findVehicle,
            samples,
            latestOdometerReading,
            insertManualReading,
            vehicleFacts,
          },
        },
        { provide: CoreClient, useValue: { requireBranch } },
        { provide: FleetClock, useValue: { now: () => now } },
      ],
    }).compile();
    service = module.get(TelemetryService);
    asOf.mockResolvedValue(dataClock);
    findVehicle.mockResolvedValue({ id: vehicleId, status: 'ACTIVE' });
    latestOdometerReading.mockResolvedValue({
      odometerKm: 1000,
      recordedAt: new Date('2026-10-17T20:00:00.000Z'),
    });
    insertManualReading.mockImplementation((_scope, data) => Promise.resolve(sample(data)));
  });

  it('reports the data clock and the Sofia business date', async () => {
    await expect(service.dataClock(context)).resolves.toEqual({
      asOf: dataClock,
      businessDate: '2026-10-18',
      timeZone: 'Europe/Sofia',
    });
    asOf.mockResolvedValue(null);
    await expect(service.dataClock(context)).resolves.toMatchObject({ asOf: null });
  });

  it('records a MANUAL reading rounded to 0.1 km with one Core check', async () => {
    await expect(
      service.recordOdometerReading(context, {
        vehicleId,
        odometerKm: 1234.56,
        recordedAt: '2026-10-17T21:00:00Z',
      }),
    ).resolves.toMatchObject({ source: 'MANUAL', deviceImei: null, odometerKm: 1234.6 });
    expect(insertManualReading).toHaveBeenCalledWith(
      scope,
      { vehicleId, odometerKm: 1234.6, recordedAt: dataClock, receivedAt: now },
      expect.any(Function),
    );
    expect(requireBranch).toHaveBeenCalledTimes(1);
  });

  it('repeats latest-reading validation under the Vehicle lock and rejects a retired vehicle', async () => {
    const reading = { vehicleId, odometerKm: 1500, recordedAt: '2026-10-17T21:00:00Z' };
    for (const [latest, path] of [
      [{ odometerKm: 1600, recordedAt: new Date('2026-10-17T20:45:00Z') }, 'odometerKm'],
      [{ odometerKm: 1000, recordedAt: dataClock }, 'recordedAt'],
    ] as const) {
      insertManualReading.mockImplementationOnce((_scope, data, check) => {
        check(latest);
        return Promise.resolve(sample(data));
      });
      expect(await fieldErrors(service.recordOdometerReading(context, reading))).toMatchObject([
        { path },
      ]);
    }
    insertManualReading.mockResolvedValueOnce(null);
    expect(await fieldErrors(service.recordOdometerReading(context, reading))).toEqual([
      { path: 'vehicleId', message: 'Choose a vehicle in this branch that is not inactive.' },
    ]);
    expect(requireBranch).toHaveBeenCalledTimes(3);
  });

  it.each([
    [{ odometerKm: -0.1 }, 'odometerKm'],
    [{ odometerKm: 10_000_000 }, 'odometerKm'],
    [{ odometerKm: Number.NaN }, 'odometerKm'],
    [{ recordedAt: '2026-10-17 21:00' }, 'recordedAt'],
    [{ vehicleId: 'vehicle' }, 'vehicleId'],
  ])('rejects %j on %s before reading', async (fields, path) => {
    expect(
      await fieldErrors(
        service.recordOdometerReading(context, {
          vehicleId,
          odometerKm: 1500,
          recordedAt: '2026-10-17T21:00:00Z',
          ...fields,
        }),
      ),
    ).toMatchObject([{ path }]);
    expect(findVehicle).not.toHaveBeenCalled();
    expect(insertManualReading).not.toHaveBeenCalled();
  });

  it('bounds the reading by the data clock, now and the previous reading', async () => {
    const reading = (recordedAt: string, odometerKm = 1500) =>
      fieldErrors(service.recordOdometerReading(context, { vehicleId, odometerKm, recordedAt }));
    // Later than the data clock (which is earlier than now).
    expect(await reading('2026-10-17T21:00:00.001Z')).toMatchObject([{ path: 'recordedAt' }]);
    // Not strictly after the previous reading.
    expect(await reading('2026-10-17T20:00:00.000Z')).toMatchObject([{ path: 'recordedAt' }]);
    // Lower than the previous reading.
    expect(await reading('2026-10-17T20:30:00.000Z', 999.9)).toMatchObject([
      { path: 'odometerKm' },
    ]);
    // Without device data only `now` bounds the time.
    asOf.mockResolvedValue(null);
    latestOdometerReading.mockResolvedValue(null);
    expect(await reading('2026-10-17T22:30:00.001Z')).toMatchObject([{ path: 'recordedAt' }]);
    await expect(
      service.recordOdometerReading(context, {
        vehicleId,
        odometerKm: 0,
        recordedAt: '2026-10-17T22:30:00.000Z',
      }),
    ).resolves.toMatchObject({ odometerKm: 0 });
    // A data clock ahead of now never allows readings after now.
    asOf.mockResolvedValue(new Date('2026-10-18T01:00:00.000Z'));
    expect(await reading('2026-10-17T23:00:00.000Z')).toMatchObject([{ path: 'recordedAt' }]);
    for (const vehicle of [null, { id: vehicleId, status: 'INACTIVE' as const }]) {
      findVehicle.mockResolvedValue(vehicle);
      expect(await reading('2026-10-17T20:30:00.000Z')).toMatchObject([{ path: 'vehicleId' }]);
    }
    expect(requireBranch).toHaveBeenCalledTimes(1);
  });

  it('validates the sample window and keeps the newest 2,000 rows in ascending order', async () => {
    const window = (from: string, to: string) =>
      fieldErrors(service.samples(context, { vehicleId, from, to }));
    expect(await window('2026-10-17T00:00:00Z', '2026-10-17T00:00:00Z')).toMatchObject([
      { path: 'to' },
    ]);
    expect(await window('2026-10-10T00:00:00Z', '2026-10-17T00:00:00.001Z')).toMatchObject([
      { path: 'to' },
    ]);
    expect(await window('yesterday', '2026-10-17T00:00:00Z')).toMatchObject([{ path: 'from' }]);
    expect(samples).not.toHaveBeenCalled();
    const newestFirst = Array.from({ length: MAX_SERIES_SAMPLES + 1 }, (_, index) =>
      sample({ recordedAt: new Date(dataClock.getTime() - index * 60_000) }),
    );
    samples.mockResolvedValue(newestFirst);
    const series = await service.samples(context, {
      vehicleId,
      from: '2026-10-10T21:00:00Z',
      to: '2026-10-17T21:00:00Z',
    });
    expect(samples).toHaveBeenCalledWith(
      scope,
      vehicleId,
      { from: new Date('2026-10-10T21:00:00Z'), to: dataClock },
      MAX_SERIES_SAMPLES + 1,
    );
    expect(series.truncated).toBe(true);
    expect(series.items).toHaveLength(MAX_SERIES_SAMPLES);
    expect(series.items.at(-1)?.recordedAt).toEqual(dataClock);
    expect(series.items[0]?.recordedAt).toEqual(
      new Date(dataClock.getTime() - (MAX_SERIES_SAMPLES - 1) * 60_000),
    );
    findVehicle.mockResolvedValue(null);
    await expect(
      service.samples(context, {
        vehicleId,
        from: '2026-10-16T21:00:00Z',
        to: '2026-10-17T21:00:00Z',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('classifies a page of vehicles with one clock and one facts query', async () => {
    const other = randomUUID();
    vehicleFacts.mockResolvedValue([
      {
        vehicleId,
        status: 'ACTIVE',
        hasDevice: true,
        latest: null,
        odometer: null,
      },
    ]);
    const states = await service.vehicleStates(scope, [vehicleId, other]);
    expect(vehicleFacts).toHaveBeenCalledWith(scope, [vehicleId, other]);
    expect(asOf).toHaveBeenCalledTimes(1);
    expect(states.get(vehicleId)).toMatchObject({ activity: 'NOT_CONNECTED' });
    expect(states.get(other)).toMatchObject({ activity: 'NO_DEVICE' });
    expect(await service.vehicleStates(scope, [])).toEqual(new Map());
    expect(vehicleFacts).toHaveBeenCalledTimes(1);
  });
});
