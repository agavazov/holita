import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { FleetClock } from '../../clock/fleet-clock.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { CreateFleetDriverInput } from '../../generated/graphql/types.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { SettingsService } from '../settings/settings.service.js';
import { defaultFleetSettings } from '../settings/settings-defaults.js';
import { EventsService } from '../events/events.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { TripsService } from '../trips/trips.service.js';
import { type DriverRow, DriversRepository } from './drivers.repository.js';
import { documentStatus, driverDocumentStatus, DriversService } from './drivers.service.js';

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

describe('Driver document status', () => {
  it('classifies each document at the business date boundaries', () => {
    const today = '2026-10-18';
    expect(documentStatus(null, today)).toBeNull();
    expect(documentStatus('2026-10-17', today)).toBe('EXPIRED');
    expect(documentStatus('2026-10-18', today)).toBe('EXPIRING');
    expect(documentStatus('2026-11-17', today)).toBe('EXPIRING');
    expect(documentStatus('2026-11-18', today)).toBe('VALID');
  });

  it('reports the worst document and NOT_RECORDED without dates', () => {
    const today = '2026-10-18';
    expect(
      driverDocumentStatus({ licenseExpiresOn: null, tachographCardExpiresOn: null }, today),
    ).toBe('NOT_RECORDED');
    expect(
      driverDocumentStatus(
        { licenseExpiresOn: '2027-01-01', tachographCardExpiresOn: null },
        today,
      ),
    ).toBe('VALID');
    expect(
      driverDocumentStatus(
        { licenseExpiresOn: '2027-01-01', tachographCardExpiresOn: '2026-11-01' },
        today,
      ),
    ).toBe('EXPIRING');
    expect(
      driverDocumentStatus(
        { licenseExpiresOn: '2026-10-17', tachographCardExpiresOn: '2026-11-01' },
        today,
      ),
    ).toBe('EXPIRED');
  });
});

describe('Drivers validation and scope', () => {
  const list = jest.fn<DriversRepository['list']>();
  const find = jest.fn<DriversRepository['find']>();
  const duplicates = jest.fn<DriversRepository['duplicates']>();
  const create = jest.fn<DriversRepository['create']>();
  const update = jest.fn<DriversRepository['update']>();
  const remove = jest.fn<DriversRepository['delete']>();
  const stats = jest.fn<DriversRepository['stats']>();
  const summary = jest.fn<DriversRepository['summary']>();
  const requireBranch = jest.fn<CoreClient['requireBranch']>();
  const readSettings = jest.fn<SettingsService['read']>();
  const asOf = jest.fn<TelemetryService['asOf']>();
  const driverScore = jest.fn<TripsService['driverScore']>();
  const maneuverTotalsByDriver = jest.fn<EventsService['maneuverTotalsByDriver']>();
  const driverManeuvers = jest.fn<EventsService['driverManeuvers']>();
  // 22:30 UTC on 17 October is already 18 October in Europe/Sofia.
  const now = new Date('2026-10-17T22:30:00.000Z');
  const context = {
    requestId: randomUUID(),
    tenantId: '01000000-0000-4000-8000-000000000001',
    branchId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map(),
  };
  const scope = { tenantId: context.tenantId, branchId: context.branchId };
  function row(overrides: Partial<DriverRow> = {}): DriverRow {
    return {
      id: randomUUID(),
      tenantId: context.tenantId,
      branchId: context.branchId,
      firstName: 'Георги',
      lastName: 'Иванов',
      employeeNumber: null,
      identificationKey: null,
      phone: null,
      email: null,
      licenseNumber: null,
      licenseCategories: [],
      licenseExpiresOn: null,
      tachographCardNumber: null,
      tachographCardExpiresOn: null,
      status: 'ACTIVE',
      notes: null,
      createdAt: now,
      updatedAt: now,
      vehicles: [],
      ...overrides,
    };
  }
  let service: DriversService;
  beforeEach(async () => {
    jest.resetAllMocks();
    readSettings.mockResolvedValue(defaultFleetSettings());
    const module = await Test.createTestingModule({
      providers: [
        DriversService,
        {
          provide: SettingsService,
          useValue: { read: readSettings },
        },
        {
          provide: DriversRepository,
          useValue: { list, find, duplicates, create, update, delete: remove, stats, summary },
        },
        { provide: CoreClient, useValue: { requireBranch } },
        { provide: FleetClock, useValue: { now: () => now } },
        { provide: TelemetryService, useValue: { asOf } },
        { provide: TripsService, useValue: { driverScore } },
        { provide: EventsService, useValue: { maneuverTotalsByDriver, driverManeuvers } },
      ],
    }).compile();
    service = module.get(DriversService);
    list.mockResolvedValue({ items: [], total: 0 });
    find.mockResolvedValue(row());
    duplicates.mockResolvedValue({ employeeNumber: false, identificationKey: false });
    create.mockResolvedValue(row());
    update.mockResolvedValue(row());
    asOf.mockResolvedValue(null);
    stats.mockResolvedValue(new Map());
    maneuverTotalsByDriver.mockResolvedValue(new Map());
    driverManeuvers.mockResolvedValue([]);
  });

  it('retains filtered 30-day facts and their clock when newer telemetry and trips are available', async () => {
    const clock = new Date('2026-10-18T06:30:00.000Z');
    const busy = row(),
      idle = row();
    list.mockResolvedValue({
      items: [
        { ...busy, dataAsOf: clock, distance30dKm: 250, tripCount30d: 4, drivingScore30d: 81.25 },
        { ...idle, dataAsOf: clock, distance30dKm: 0, tripCount30d: 0, drivingScore30d: null },
      ],
      total: 2,
    });
    asOf.mockResolvedValue(new Date(clock.getTime() + 86_400_000));
    stats.mockResolvedValue(
      new Map([[busy.id, { distance30dKm: 1000, tripCount30d: 5, drivingScore30d: 20 }]]),
    );
    maneuverTotalsByDriver.mockResolvedValue(new Map([[busy.id, 5]]));
    const page = await service.list(context, {
      filter: { allOf: [{ distanceKmBelow: 300 }] },
      sort: { field: 'DRIVING_SCORE_30D', direction: 'DESC' },
    });
    const window = { start: new Date('2026-09-18T06:30:00.000Z'), end: clock };
    expect(stats).not.toHaveBeenCalled();
    expect(asOf).not.toHaveBeenCalled();
    expect(maneuverTotalsByDriver).toHaveBeenCalledWith(scope, [busy.id, idle.id], window);
    expect(page.total).toBe(2);
    expect(page.items.map((driver) => driver.id)).toEqual([busy.id, idle.id]);
    expect(page.items).toMatchObject([
      { distance30dKm: 250, tripCount30d: 4, drivingScore30d: 81.25, maneuversPer100Km30d: 2 },
      { distance30dKm: 0, tripCount30d: 0, drivingScore30d: null, maneuversPer100Km30d: null },
    ]);
    list.mockResolvedValue({
      items: [busy, idle].map((driver) => ({
        ...driver,
        dataAsOf: null,
        distance30dKm: 0,
        tripCount30d: 0,
        drivingScore30d: null,
      })),
      total: 2,
    });
    maneuverTotalsByDriver.mockClear();
    expect((await service.list(context, {})).items).toMatchObject([
      { distance30dKm: 0, tripCount30d: 0, drivingScore30d: null, maneuversPer100Km30d: null },
      { distance30dKm: 0, tripCount30d: 0, drivingScore30d: null, maneuversPer100Km30d: null },
    ]);
    expect(stats).not.toHaveBeenCalled();
    expect(asOf).not.toHaveBeenCalled();
    expect(maneuverTotalsByDriver).not.toHaveBeenCalled();
  });

  it('builds the scorecard over the requested days and flags low confidence', async () => {
    const clock = new Date('2026-10-18T06:30:00.000Z');
    const driver = row();
    find.mockResolvedValue(driver);
    asOf.mockResolvedValue(clock);
    driverScore.mockResolvedValue({
      tripCount: 6,
      distanceKm: 400,
      scoredTripCount: 4,
      averageDrivingScore: 81.5,
      averageEcoScore: null,
    });
    const maneuvers = [
      {
        kind: 'HARSH_BRAKING' as const,
        intensity1: 3,
        intensity2: 2,
        intensity3: 1,
        intensityUnknown: 0,
        total: 6,
      },
    ];
    driverManeuvers.mockResolvedValue(maneuvers);
    const window = { start: new Date('2026-10-11T06:30:00.000Z'), end: clock };
    expect(await service.scorecard(context, { driverId: driver.id, days: 7 })).toMatchObject({
      driver: { id: driver.id },
      asOf: clock,
      windowStart: window.start,
      windowEnd: clock,
      distanceKm: 400,
      tripCount: 6,
      scoredTripCount: 4,
      averageDrivingScore: 81.5,
      averageEcoScore: null,
      maneuverCount: 6,
      maneuversPer100Km: 1.5,
      maneuvers,
      lowConfidence: true,
    });
    expect(driverScore).toHaveBeenCalledWith(scope, driver.id, window);
    expect(driverManeuvers).toHaveBeenCalledWith(scope, driver.id, window);
    driverScore.mockResolvedValue({
      tripCount: 5,
      distanceKm: 0,
      scoredTripCount: 5,
      averageDrivingScore: null,
      averageEcoScore: null,
    });
    expect(await service.scorecard(context, { driverId: driver.id })).toMatchObject({
      lowConfidence: false,
      maneuversPer100Km: null,
    });
    asOf.mockResolvedValue(null);
    driverScore.mockClear();
    expect(await service.scorecard(context, { driverId: driver.id, days: 30 })).toMatchObject({
      asOf: null,
      windowStart: null,
      windowEnd: null,
      distanceKm: 0,
      tripCount: 0,
      scoredTripCount: 0,
      averageDrivingScore: null,
      lowConfidence: true,
    });
    expect(driverScore).not.toHaveBeenCalled();
    for (const days of [0, 94, 1.5]) {
      expect(
        await fieldErrors(service.scorecard(context, { driverId: driver.id, days })),
      ).toMatchObject([{ path: 'days' }]);
    }
    find.mockResolvedValue(null);
    await expect(service.scorecard(context, { driverId: driver.id })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('maps filters with the Sofia business date and the last-name default sort', async () => {
    await service.list(context, {
      search: 'Георги Иванов',
      filter: {
        statuses: ['ACTIVE'],
        licenseCategories: ['CE', 'C'],
        documentsExpireWithinDays: 30,
        hasVehicle: false,
      },
    });
    expect(list).toHaveBeenLastCalledWith(
      scope,
      { offset: 0, limit: 20 },
      {
        tokens: ['Георги', 'Иванов'],
        ids: undefined,
        statuses: ['ACTIVE'],
        licenseCategories: ['CE', 'C'],
        documentsExpireBy: new Date('2026-11-17T00:00:00.000Z'),
        hasVehicle: false,
      },
      { field: 'LAST_NAME', direction: 'ASC' },
    );
    for (const documentsExpireWithinDays of [-1, 366, 1.5]) {
      expect(
        await fieldErrors(service.list(context, { filter: { documentsExpireWithinDays } })),
      ).toMatchObject([{ path: 'filter' }]);
    }
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('keeps repeated conditions and derived sort in the repository request before paging', async () => {
    const vehicleId = randomUUID();
    await service.list(context, {
      offset: 2,
      limit: 1,
      filter: {
        allOf: [
          { statuses: ['ACTIVE'], scoreAbove: 70 },
          { excludedStatuses: ['ACTIVE'], scoreBelow: 85 },
          { vehicleIds: [vehicleId.toUpperCase()], hasScore: false },
        ],
      },
      sort: { field: 'DRIVING_SCORE_30D', direction: 'DESC' },
    });
    expect(list).toHaveBeenCalledWith(
      scope,
      { offset: 2, limit: 1 },
      expect.objectContaining({
        allOf: [
          expect.objectContaining({ statuses: ['ACTIVE'], scoreAbove: 70 }),
          expect.objectContaining({ excludedStatuses: ['ACTIVE'], scoreBelow: 85 }),
          expect.objectContaining({ vehicleIds: [vehicleId], hasScore: false }),
        ],
      }),
      { field: 'DRIVING_SCORE_30D', direction: 'DESC' },
    );
    expect(driverScore).not.toHaveBeenCalled();
    expect(stats).not.toHaveBeenCalled();
  });

  it('delegates whole-Branch summary using the inclusive document warning boundary', async () => {
    const totals = {
      dataAsOf: null,
      active: 2,
      onLeave: 1,
      documentsExpiring: 3,
      averageDrivingScore: 81.25,
      distance30dKm: 400,
    };
    summary.mockResolvedValue(totals);
    await expect(service.summary(context)).resolves.toEqual(totals);
    expect(summary).toHaveBeenCalledWith(scope, new Date('2026-11-17T00:00:00Z'));
    expect(list).not.toHaveBeenCalled();
    expect(driverScore).not.toHaveBeenCalled();
  });

  it('keeps successful bulk deletions and scoped history/not-found failures independent', async () => {
    const deleted = row();
    const protectedId = randomUUID();
    const missingId = randomUUID();
    remove
      .mockResolvedValueOnce(deleted)
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('FK', { code: 'P2003', clientVersion: '7' }),
      )
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Missing', { code: 'P2025', clientVersion: '7' }),
      );
    await expect(
      service.deleteMany(context, [deleted.id, protectedId, missingId]),
    ).resolves.toEqual({
      succeededIds: [deleted.id],
      failures: [
        {
          id: protectedId,
          code: 'CONFLICT',
          message: 'Driver is assigned or has trip history; set the driver inactive instead.',
        },
        { id: missingId, code: 'NOT_FOUND', message: 'Driver not found' },
      ],
    });
    expect(remove).toHaveBeenNthCalledWith(1, scope, deleted.id);
    expect(remove).toHaveBeenNthCalledWith(2, scope, protectedId);
    expect(remove).toHaveBeenNthCalledWith(3, scope, missingId);
    expect(asOf).not.toHaveBeenCalled();
    expect(stats).not.toHaveBeenCalled();
    expect(maneuverTotalsByDriver).not.toHaveBeenCalled();
    expect(readSettings).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('deactivates only unassigned bulk rows and preserves the locked assignment failure', async () => {
    const assigned = row({
      vehicles: [
        {
          id: randomUUID(),
          licensePlate: 'ASSIGNED',
          fleetNumber: null,
          vehicleType: null,
          status: 'ACTIVE',
        },
      ],
    });
    const available = row();
    const missingId = randomUUID();
    find
      .mockResolvedValueOnce(assigned)
      .mockResolvedValueOnce(available)
      .mockResolvedValueOnce(null);
    update.mockResolvedValue(row({ id: available.id, status: 'INACTIVE' }));
    await expect(
      service.deactivateMany(context, [assigned.id, available.id, missingId]),
    ).resolves.toEqual({
      succeededIds: [available.id],
      failures: [
        {
          id: assigned.id,
          code: 'BAD_USER_INPUT',
          message: 'Unassign the driver from its vehicles first.',
        },
        { id: missingId, code: 'NOT_FOUND', message: 'Driver not found' },
      ],
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(scope, available.id, { status: 'INACTIVE' });
    expect(find).toHaveBeenNthCalledWith(1, scope, assigned.id);
    expect(find).toHaveBeenNthCalledWith(2, scope, available.id);
    expect(find).toHaveBeenNthCalledWith(3, scope, missingId);
    expect(asOf).not.toHaveBeenCalled();
    expect(stats).not.toHaveBeenCalled();
    expect(maneuverTotalsByDriver).not.toHaveBeenCalled();
    expect(readSettings).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('still hydrates public single status changes and deletions with current statistics', async () => {
    const changed = row({ status: 'INACTIVE' });
    const deleted = row();
    find.mockResolvedValue(changed);
    update.mockResolvedValue(changed);
    remove.mockResolvedValue(deleted);
    asOf.mockResolvedValue(now);
    stats.mockResolvedValue(
      new Map([
        [changed.id, { distance30dKm: 200, tripCount30d: 4, drivingScore30d: 81 }],
        [deleted.id, { distance30dKm: 100, tripCount30d: 2, drivingScore30d: 90 }],
      ]),
    );
    maneuverTotalsByDriver.mockResolvedValue(new Map([[changed.id, 6], [deleted.id, 2]]));
    await expect(service.update(context, changed.id, { status: 'INACTIVE' })).resolves.toMatchObject({
      id: changed.id,
      status: 'INACTIVE',
      distance30dKm: 200,
      tripCount30d: 4,
      drivingScore30d: 81,
      maneuversPer100Km30d: 3,
    });
    await expect(service.delete(context, deleted.id)).resolves.toMatchObject({
      id: deleted.id,
      distance30dKm: 100,
      tripCount30d: 2,
      drivingScore30d: 90,
      maneuversPer100Km30d: 2,
    });
    for (const [index, id] of [changed.id, deleted.id].entries()) {
      expect(asOf).toHaveBeenNthCalledWith(index + 1, scope);
      expect(stats).toHaveBeenNthCalledWith(index + 1, scope, [id], expect.any(Object));
      expect(maneuverTotalsByDriver).toHaveBeenNthCalledWith(
        index + 1, scope, [id], expect.any(Object),
      );
      expect(readSettings).toHaveBeenNthCalledWith(index + 1, scope);
    }
  });

  it('rejects invalid bulk selections before any mutation', async () => {
    for (const values of [[], ['invalid'], Array.from({ length: 101 }, () => randomUUID())]) {
      await expect(service.deleteMany(context, values)).rejects.toThrow(BadRequestException);
      await expect(service.deactivateMany(context, values)).rejects.toThrow(BadRequestException);
    }
    expect(remove).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('creates with normalised fields, dates as UTC midnight and one Core check', async () => {
    find.mockResolvedValue(null);
    create.mockResolvedValue(
      row({
        licenseExpiresOn: new Date('2026-11-17T00:00:00.000Z'),
        tachographCardExpiresOn: new Date('2027-05-01T00:00:00.000Z'),
      }),
    );
    const result = await service.create(context, {
      firstName: ' Георги ',
      lastName: ' Иванов ',
      employeeNumber: ' E-001 ',
      identificationKey: ' 01A2B3 ',
      phone: ' +359 888 123 456 ',
      email: ' g.ivanov@example.test ',
      licenseCategories: ['CE', 'B', 'C'],
      licenseExpiresOn: '2026-11-17',
      tachographCardExpiresOn: '2027-05-01',
    });
    expect(duplicates).toHaveBeenCalledWith(
      scope,
      { employeeNumber: 'E-001', identificationKey: '01A2B3' },
      null,
    );
    expect(requireBranch).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(scope, {
      firstName: 'Георги',
      lastName: 'Иванов',
      employeeNumber: 'E-001',
      identificationKey: '01A2B3',
      phone: '+359 888 123 456',
      email: 'g.ivanov@example.test',
      licenseNumber: null,
      licenseCategories: ['B', 'C', 'CE'],
      licenseExpiresOn: new Date('2026-11-17T00:00:00.000Z'),
      tachographCardNumber: null,
      tachographCardExpiresOn: new Date('2027-05-01T00:00:00.000Z'),
      status: 'ACTIVE',
      notes: null,
    });
    expect(result).toMatchObject({
      licenseExpiresOn: '2026-11-17',
      tachographCardExpiresOn: '2027-05-01',
      documentStatus: 'EXPIRING',
      vehicles: [],
    });
  });

  it.each([
    [{ firstName: ' ' }, 'firstName'],
    [{ lastName: 'L'.repeat(65) }, 'lastName'],
    [{ employeeNumber: 'E'.repeat(33) }, 'employeeNumber'],
    [{ identificationKey: 'K'.repeat(33) }, 'identificationKey'],
    [{ phone: '12345' }, 'phone'],
    [{ phone: '+359-888' }, 'phone'],
    [{ email: 'driver@example' }, 'email'],
    [{ email: 'two words@example.test' }, 'email'],
    [{ licenseNumber: 'N'.repeat(33) }, 'licenseNumber'],
    [{ licenseCategories: ['C', 'C'] }, 'licenseCategories'],
    [{ licenseExpiresOn: '2026-02-30' }, 'licenseExpiresOn'],
    [{ tachographCardExpiresOn: '2101-01-01' }, 'tachographCardExpiresOn'],
    [{ tachographCardNumber: 'T'.repeat(17) }, 'tachographCardNumber'],
    [{ notes: 'n'.repeat(2001) }, 'notes'],
  ] satisfies [Partial<CreateFleetDriverInput>, string][])(
    'rejects %j on %s without Core calls or writes',
    async (fields, path) => {
      expect(
        await fieldErrors(
          service.create(context, { firstName: 'Георги', lastName: 'Иванов', ...fields }),
        ),
      ).toMatchObject([{ path }]);
      expect(create).not.toHaveBeenCalled();
      expect(requireBranch).not.toHaveBeenCalled();
    },
  );

  it('reports both duplicated identifiers in one error', async () => {
    duplicates.mockResolvedValue({ employeeNumber: true, identificationKey: true });
    expect(
      await fieldErrors(
        service.create(context, {
          firstName: 'A',
          lastName: 'B',
          employeeNumber: 'E-1',
          identificationKey: 'K-1',
        }),
      ),
    ).toEqual([
      {
        path: 'employeeNumber',
        message: 'Employee number is already used in this branch.',
        code: 'ALREADY_EXISTS',
      },
      {
        path: 'identificationKey',
        message: 'Identification key is already used in this branch.',
        code: 'ALREADY_EXISTS',
      },
    ]);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses INACTIVE while the driver has current vehicles', async () => {
    const id = randomUUID();
    find.mockResolvedValue(
      row({
        id,
        vehicles: [
          {
            id: randomUUID(),
            licensePlate: 'CA1234AB',
            fleetNumber: null,
            vehicleType: null,
            status: 'ACTIVE',
          },
        ],
      }),
    );
    expect(await fieldErrors(service.update(context, id, { status: 'INACTIVE' }))).toEqual([
      {
        path: 'status',
        message: 'Unassign the driver from its vehicles first.',
        code: 'DRIVER_ASSIGNED',
      },
    ]);
    await service.update(context, id, { status: 'ON_LEAVE', licenseExpiresOn: null });
    expect(update).toHaveBeenLastCalledWith(scope, id, {
      status: 'ON_LEAVE',
      licenseExpiresOn: null,
    });
    find.mockResolvedValue(row({ id }));
    await service.update(context, id, { status: 'INACTIVE' });
    expect(update).toHaveBeenLastCalledWith(scope, id, { status: 'INACTIVE' });
    for (const input of [{ firstName: null }, { status: null }]) {
      expect(await fieldErrors(service.update(context, id, input))).toHaveLength(1);
    }
    await expect(service.update(context, id, {})).rejects.toThrow(
      'Provide at least one driver field to update',
    );
    find.mockResolvedValue(null);
    await expect(service.update(context, id, { notes: 'x' })).rejects.toThrow(NotFoundException);
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('reports an assignment committed before the locked deactivation as the same status error', async () => {
    const id = randomUUID();
    find.mockResolvedValue(row({ id }));
    update.mockResolvedValue(null);
    expect(await fieldErrors(service.update(context, id, { status: 'INACTIVE' }))).toEqual([
      {
        path: 'status',
        message: 'Unassign the driver from its vehicles first.',
        code: 'DRIVER_ASSIGNED',
      },
    ]);
    expect(update).toHaveBeenCalledWith(scope, id, { status: 'INACTIVE' });
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('protects deletion of assigned drivers', async () => {
    remove.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK', { code: 'P2003', clientVersion: '7' }),
    );
    await expect(service.delete(context, randomUUID())).rejects.toThrow(
      new ConflictException(
        'Driver is assigned or has trip history; set the driver inactive instead.',
      ),
    );
  });
});
