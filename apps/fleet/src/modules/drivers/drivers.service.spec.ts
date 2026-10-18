import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { FleetClock } from '../../clock/fleet-clock.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { CreateFleetDriverInput } from '../../generated/graphql/types.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { EventsService } from '../events/events.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { TripsService } from '../trips/trips.service.js';
import { type DriverRow, DriversRepository } from './drivers.repository.js';
import { documentStatus, driverDocumentStatus, DriversService } from './drivers.service.js';

async function fieldErrors(action: Promise<unknown>): Promise<unknown> {
  try {
    await action;
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
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
  const requireBranch = jest.fn<CoreClient['requireBranch']>();
  const asOf = jest.fn<TelemetryService['asOf']>();
  const driverTotals = jest.fn<TripsService['driverTotals']>();
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
    const module = await Test.createTestingModule({
      providers: [
        DriversService,
        {
          provide: DriversRepository,
          useValue: { list, find, duplicates, create, update, delete: remove },
        },
        { provide: CoreClient, useValue: { requireBranch } },
        { provide: FleetClock, useValue: { now: () => now } },
        { provide: TelemetryService, useValue: { asOf } },
        { provide: TripsService, useValue: { driverTotals, driverScore } },
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
    driverTotals.mockResolvedValue(new Map());
    maneuverTotalsByDriver.mockResolvedValue(new Map());
    driverManeuvers.mockResolvedValue([]);
  });

  it('attaches 30-day statistics before the data clock for the whole page', async () => {
    const clock = new Date('2026-10-18T06:30:00.000Z');
    const busy = row(),
      idle = row();
    list.mockResolvedValue({ items: [busy, idle], total: 2 });
    asOf.mockResolvedValue(clock);
    driverTotals.mockResolvedValue(new Map([[busy.id, { distanceKm: 250, tripCount: 4 }]]));
    maneuverTotalsByDriver.mockResolvedValue(new Map([[busy.id, 5]]));
    const page = await service.list(context, {});
    const window = { start: new Date('2026-09-18T06:30:00.000Z'), end: clock };
    expect(driverTotals).toHaveBeenCalledWith(scope, [busy.id, idle.id], window);
    expect(maneuverTotalsByDriver).toHaveBeenCalledWith(scope, [busy.id, idle.id], window);
    expect(page.items).toMatchObject([
      { distance30dKm: 250, tripCount30d: 4, maneuversPer100Km30d: 2 },
      { distance30dKm: 0, tripCount30d: 0, maneuversPer100Km30d: null },
    ]);
    asOf.mockResolvedValue(null);
    driverTotals.mockClear();
    expect((await service.list(context, {})).items).toMatchObject([
      { distance30dKm: 0, tripCount30d: 0, maneuversPer100Km30d: null },
      { distance30dKm: 0, tripCount30d: 0, maneuversPer100Km30d: null },
    ]);
    expect(driverTotals).not.toHaveBeenCalled();
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
    for (const days of [0, 94, 1.5])
      expect(
        await fieldErrors(service.scorecard(context, { driverId: driver.id, days })),
      ).toMatchObject([{ path: 'days' }]);
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
    for (const documentsExpireWithinDays of [-1, 366, 1.5])
      expect(
        await fieldErrors(service.list(context, { filter: { documentsExpireWithinDays } })),
      ).toMatchObject([{ path: 'filter' }]);
    expect(requireBranch).not.toHaveBeenCalled();
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
      { path: 'employeeNumber', message: 'Employee number is already used in this branch.' },
      {
        path: 'identificationKey',
        message: 'Identification key is already used in this branch.',
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
      { path: 'status', message: 'Unassign the driver from its vehicles first.' },
    ]);
    await service.update(context, id, { status: 'ON_LEAVE', licenseExpiresOn: null });
    expect(update).toHaveBeenLastCalledWith(scope, id, {
      status: 'ON_LEAVE',
      licenseExpiresOn: null,
    });
    find.mockResolvedValue(row({ id }));
    await service.update(context, id, { status: 'INACTIVE' });
    expect(update).toHaveBeenLastCalledWith(scope, id, { status: 'INACTIVE' });
    for (const input of [{ firstName: null }, { status: null }])
      expect(await fieldErrors(service.update(context, id, input))).toHaveLength(1);
    await expect(service.update(context, id, {})).rejects.toThrow(
      'Provide at least one driver field to update',
    );
    find.mockResolvedValue(null);
    await expect(service.update(context, id, { notes: 'x' })).rejects.toThrow(NotFoundException);
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
