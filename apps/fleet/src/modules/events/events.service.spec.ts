import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { FleetClock } from '../../clock/fleet-clock.js';
import type { FleetAlertStatus, FleetEventKind } from '../../generated/prisma/enums.js';
import { type EventRow, EventsRepository } from './events.repository.js';
import {
  type AlertTransition,
  EventsService,
  MANEUVER_KINDS,
  measurementUnit,
} from './events.service.js';

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

describe('Event measurement units', () => {
  it('names the unit of measured values by kind', () => {
    const units: [FleetEventKind, string | null][] = [
      ['SPEEDING', 'KPH'],
      ['IDLING', 'MINUTE'],
      ['DEVICE_OFFLINE', 'MINUTE'],
      ['LOW_FUEL', 'PERCENT'],
      ['FUEL_DROP', 'PERCENT'],
      ['POWER_DISCONNECTED', 'VOLT'],
      ['LOW_BACKUP_BATTERY', 'VOLT'],
      ['HARSH_BRAKING', null],
      ['DIAGNOSTIC_TROUBLE_CODE', null],
      ['CRASH_DETECTED', null],
    ];
    for (const [kind, unit] of units) {
      expect(measurementUnit(kind)).toBe(unit);
    }
    expect(MANEUVER_KINDS).toHaveLength(9);
    expect(MANEUVER_KINDS.at(-1)).toBe('SPEEDING');
  });
});

describe('Events, alert counts and transitions', () => {
  const list = jest.fn<EventsRepository['list']>();
  const find = jest.fn<EventsRepository['find']>();
  const alertCounts = jest.fn<EventsRepository['alertCounts']>();
  const kindIntensityCounts = jest.fn<EventsRepository['kindIntensityCounts']>();
  const transition = jest.fn<EventsRepository['transition']>();
  const now = new Date('2026-10-18T07:00:00.000Z');
  const context = {
    requestId: randomUUID(),
    tenantId: '01000000-0000-4000-8000-000000000001',
    branchId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map(),
  };
  const scope = { tenantId: context.tenantId, branchId: context.branchId };
  const vehicleId = randomUUID();
  function row(overrides: Partial<EventRow> = {}): EventRow {
    return {
      id: randomUUID(),
      tenantId: context.tenantId,
      branchId: context.branchId,
      vehicleId,
      tripId: null,
      driverId: null,
      deviceImei: '990601000000001',
      source: 'DEMO',
      occurredAt: new Date('2026-10-18T06:00:00.000Z'),
      kind: 'SPEEDING',
      severity: 'WARNING',
      intensity: 3,
      latitude: null,
      longitude: null,
      address: null,
      speedKph: 128,
      measuredValue: 128,
      thresholdValue: 90,
      troubleCode: null,
      details: null,
      alertStatus: 'OPEN',
      acknowledgedAt: null,
      resolvedAt: null,
      remark: null,
      createdAt: now,
      updatedAt: now,
      vehicle: {
        id: vehicleId,
        licensePlate: 'CB 1028 AX',
        fleetNumber: 'Б-02',
        vehicleType: 'VAN',
        status: 'ACTIVE',
      },
      driver: null,
      ...overrides,
    };
  }
  let service: EventsService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: EventsRepository,
          useValue: { list, find, alertCounts, kindIntensityCounts, transition },
        },
        { provide: FleetClock, useValue: { now: () => now } },
      ],
    }).compile();
    service = module.get(EventsService);
    list.mockResolvedValue({ items: [row()], total: 1 });
    find.mockResolvedValue(row());
    transition.mockResolvedValue(1);
  });

  it('maps the event filter and exposes the measurement unit', async () => {
    const page = await service.list(context, {
      search: 'P0299',
      filter: {
        actionable: true,
        alertStatuses: ['OPEN', 'ACKNOWLEDGED'],
        severities: ['CRITICAL'],
        kinds: ['SPEEDING'],
        vehicleIds: [vehicleId],
        occurredFrom: '2026-10-17T06:30:00Z',
        occurredTo: '2026-10-18T06:30:00Z',
      },
      sort: { field: 'SEVERITY', direction: 'DESC' },
    });
    expect(list).toHaveBeenCalledWith(
      scope,
      { offset: 0, limit: 20 },
      {
        tokens: ['P0299'],
        ids: undefined,
        actionable: true,
        alertStatuses: ['OPEN', 'ACKNOWLEDGED'],
        severities: ['CRITICAL'],
        kinds: ['SPEEDING'],
        vehicleIds: [vehicleId],
        driverIds: undefined,
        tripIds: undefined,
        occurredFrom: new Date('2026-10-17T06:30:00.000Z'),
        occurredTo: new Date('2026-10-18T06:30:00.000Z'),
      },
      { field: 'SEVERITY', direction: 'DESC' },
    );
    expect(page.items).toMatchObject([{ measurementUnit: 'KPH', alertStatus: 'OPEN' }]);
    expect(
      await fieldErrors(service.list(context, { filter: { alertStatuses: [] } })),
    ).toMatchObject([{ path: 'filter' }]);
  });

  it('counts alerts for the same search and filter without the status parts', async () => {
    alertCounts.mockResolvedValue([
      { alertStatus: 'OPEN', severity: 'CRITICAL', count: 2 },
      { alertStatus: 'OPEN', severity: 'WARNING', count: 5 },
      { alertStatus: 'ACKNOWLEDGED', severity: 'WARNING', count: 3 },
      { alertStatus: 'RESOLVED', severity: 'CRITICAL', count: 1 },
      { alertStatus: 'RESOLVED', severity: 'WARNING', count: 6 },
    ]);
    await expect(
      service.alertCounts(context, {
        search: 'CB 10',
        filter: { actionable: false, alertStatuses: ['RESOLVED'], severities: ['WARNING'] },
      }),
    ).resolves.toEqual({ open: 7, openCritical: 2, acknowledged: 3, resolved: 7 });
    expect(alertCounts).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        tokens: ['CB', '10'],
        actionable: undefined,
        alertStatuses: undefined,
        severities: ['WARNING'],
      }),
    );
    expect(
      await fieldErrors(service.alertCounts(context, { search: 'a b c d e f' })),
    ).toMatchObject([{ path: 'search' }]);
  });

  it('returns nine maneuver rows and requires trips or a bounded period', async () => {
    kindIntensityCounts.mockResolvedValue([
      { kind: 'HARSH_BRAKING', intensity: 1, count: 4 },
      { kind: 'HARSH_BRAKING', intensity: 3, count: 1 },
      { kind: 'HARSH_BRAKING', intensity: null, count: 2 },
      { kind: 'SPEEDING', intensity: 2, count: 3 },
    ]);
    const tripId = randomUUID();
    const rows = await service.maneuverCounts(context, { filter: { tripIds: [tripId] } });
    expect(rows.map((item) => item.kind)).toEqual(MANEUVER_KINDS);
    expect(rows[1]).toEqual({
      kind: 'HARSH_BRAKING',
      intensity1: 4,
      intensity2: 0,
      intensity3: 1,
      intensityUnknown: 2,
      total: 7,
    });
    expect(rows[0]).toMatchObject({ kind: 'HARSH_ACCELERATION', total: 0 });
    expect(rows[8]).toMatchObject({ kind: 'SPEEDING', intensity2: 3, total: 3 });
    expect(kindIntensityCounts).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ tripIds: [tripId] }),
      MANEUVER_KINDS,
    );
    await service.maneuverCounts(context, {
      filter: { occurredFrom: '2026-07-17T06:30:00Z', occurredTo: '2026-10-18T06:30:00Z' },
    });
    for (const filter of [
      {},
      { occurredFrom: '2026-07-17T06:29:59Z', occurredTo: '2026-10-18T06:30:00Z' },
      { occurredFrom: '2026-10-11T00:00:00Z' },
    ]) {
      expect(await fieldErrors(service.maneuverCounts(context, { filter }))).toMatchObject([
        { path: 'filter' },
      ]);
    }
    expect(kindIntensityCounts).toHaveBeenCalledTimes(2);
  });

  const statuses: FleetAlertStatus[] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];
  const allowed: Record<AlertTransition, FleetAlertStatus[]> = {
    acknowledge: ['OPEN'],
    resolve: ['OPEN', 'ACKNOWLEDGED'],
    reopen: ['RESOLVED'],
  };
  const changes: Record<AlertTransition, Record<string, unknown>> = {
    acknowledge: { alertStatus: 'ACKNOWLEDGED', acknowledgedAt: now },
    resolve: { alertStatus: 'RESOLVED', resolvedAt: now },
    reopen: { alertStatus: 'OPEN', acknowledgedAt: null, resolvedAt: null },
  };
  for (const action of ['acknowledge', 'resolve', 'reopen'] as const) {
    for (const expectedStatus of statuses) {
      it(`${action} with expected ${expectedStatus}`, async () => {
        const id = randomUUID();
        const result = service.transition(context, action, id, { expectedStatus });
        if (allowed[action].includes(expectedStatus)) {
          await expect(result).resolves.toMatchObject({ id: expect.any(String) });
          expect(transition).toHaveBeenCalledWith(scope, id, expectedStatus, changes[action]);
        } else {
          expect(await fieldErrors(result)).toMatchObject([{ path: 'expectedStatus' }]);
          expect(transition).not.toHaveBeenCalled();
          expect(find).not.toHaveBeenCalled();
        }
      });
    }
  }

  it('keeps, clears or sets the remark', async () => {
    const id = randomUUID();
    await service.transition(context, 'acknowledge', id, { expectedStatus: 'OPEN' });
    expect(transition).toHaveBeenLastCalledWith(scope, id, 'OPEN', {
      alertStatus: 'ACKNOWLEDGED',
      acknowledgedAt: now,
    });
    for (const remark of [null, '   ']) {
      await service.transition(context, 'resolve', id, { expectedStatus: 'OPEN', remark });
      expect(transition).toHaveBeenLastCalledWith(scope, id, 'OPEN', {
        alertStatus: 'RESOLVED',
        resolvedAt: now,
        remark: null,
      });
    }
    await service.transition(context, 'reopen', id, {
      expectedStatus: 'RESOLVED',
      remark: ' Разговор с водача ',
    });
    expect(transition).toHaveBeenLastCalledWith(scope, id, 'RESOLVED', {
      alertStatus: 'OPEN',
      acknowledgedAt: null,
      resolvedAt: null,
      remark: 'Разговор с водача',
    });
    transition.mockClear();
    for (const remark of ['r'.repeat(1001), 'a\u0000b']) {
      expect(
        await fieldErrors(
          service.transition(context, 'acknowledge', id, { expectedStatus: 'OPEN', remark }),
        ),
      ).toMatchObject([{ path: 'remark' }]);
    }
    expect(transition).not.toHaveBeenCalled();
  });

  it('reports a changed alert as CONFLICT and an informational or foreign event as NOT_FOUND', async () => {
    const id = randomUUID();
    transition.mockResolvedValue(0);
    find.mockResolvedValue(row({ id, alertStatus: 'ACKNOWLEDGED', acknowledgedAt: now }));
    await expect(
      service.transition(context, 'acknowledge', id, { expectedStatus: 'OPEN' }),
    ).rejects.toThrow(new ConflictException('The alert changed after it was loaded; reload it.'));
    find.mockResolvedValue(row({ id, alertStatus: null, severity: 'INFO' }));
    await expect(
      service.transition(context, 'acknowledge', id, { expectedStatus: 'OPEN' }),
    ).rejects.toThrow(new NotFoundException('Alert not found'));
    find.mockResolvedValue(null);
    await expect(
      service.transition(context, 'resolve', id, { expectedStatus: 'OPEN' }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.transition(context, 'resolve', 'event', { expectedStatus: 'OPEN' }),
    ).rejects.toThrow(BadRequestException);
  });
});
