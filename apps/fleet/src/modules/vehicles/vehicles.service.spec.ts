import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { EventsService } from '../events/events.service.js';
import { ServiceTasksService } from '../service-tasks/service-tasks.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { classifyVehicleState, NO_FACTS } from '../telemetry/vehicle-state.js';
import { type VehicleListRow, type VehicleRow, VehiclesRepository } from './vehicles.repository.js';
import { VehiclesService } from './vehicles.service.js';

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

describe('Vehicles validation and scope', () => {
  const list = jest.fn<VehiclesRepository['list']>();
  const summary = jest.fn<VehiclesRepository['summary']>();
  const find = jest.fn<VehiclesRepository['find']>();
  const findGroup = jest.fn<VehiclesRepository['findGroup']>();
  const findDriver = jest.fn<VehiclesRepository['findDriver']>();
  const duplicates = jest.fn<VehiclesRepository['duplicates']>();
  const create = jest.fn<VehiclesRepository['create']>();
  const update = jest.fn<VehiclesRepository['update']>();
  const deactivate = jest.fn<VehiclesRepository['deactivate']>();
  const remove = jest.fn<VehiclesRepository['delete']>();
  const requireBranch = jest.fn<CoreClient['requireBranch']>();
  const vehicleStates = jest.fn<TelemetryService['vehicleStates']>();
  const openAlertCounts = jest.fn<EventsService['openAlertCounts']>();
  const nextForVehicles = jest.fn<ServiceTasksService['nextForVehicles']>();
  const context = {
    requestId: randomUUID(),
    tenantId: '01000000-0000-4000-8000-000000000001',
    branchId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map(),
  };
  const scope = { tenantId: context.tenantId, branchId: context.branchId };
  const groupId = randomUUID(),
    driverId = randomUUID();
  function row(overrides: Partial<VehicleRow> = {}): VehicleRow {
    return {
      id: randomUUID(),
      tenantId: context.tenantId,
      branchId: context.branchId,
      licensePlate: 'CA1234AB',
      notes: null,
      fleetNumber: null,
      vehicleType: null,
      make: null,
      model: null,
      modelYear: null,
      vin: null,
      fuelType: null,
      fuelTankCapacityL: null,
      status: 'ACTIVE',
      groupId: null,
      currentDriverId: null,
      group: null,
      currentDriver: null,
      _count: { devices: 2 },
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-02T00:00:00Z'),
      ...overrides,
    };
  }
  function listRow(overrides: Partial<VehicleListRow> = {}): VehicleListRow {
    return {
      ...row(),
      state: classifyVehicleState(NO_FACTS, null),
      openAlertCount: 0,
      ...overrides,
    };
  }
  let service: VehiclesService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        VehiclesService,
        {
          provide: VehiclesRepository,
          useValue: {
            list,
            summary,
            find,
            findGroup,
            findDriver,
            duplicates,
            create,
            update,
            deactivate,
            delete: remove,
          },
        },
        { provide: CoreClient, useValue: { requireBranch } },
        { provide: TelemetryService, useValue: { vehicleStates } },
        { provide: EventsService, useValue: { openAlertCounts } },
        { provide: ServiceTasksService, useValue: { nextForVehicles } },
      ],
    }).compile();
    service = module.get(VehiclesService);
    list.mockResolvedValue({ items: [listRow()], total: 1 });
    create.mockResolvedValue(row());
    update.mockResolvedValue(row());
    findGroup.mockResolvedValue({ id: groupId });
    findDriver.mockResolvedValue({ id: driverId, status: 'ACTIVE' });
    duplicates.mockResolvedValue({ fleetNumber: false, vin: false });
    vehicleStates.mockImplementation((_scope, ids) =>
      Promise.resolve(new Map(ids.map((id) => [id, classifyVehicleState(NO_FACTS, null)]))),
    );
    openAlertCounts.mockResolvedValue(new Map());
    nextForVehicles.mockResolvedValue(new Map());
  });

  it('preserves scoped list snapshot state and alert counts while batching next service separately', async () => {
    const parked = {
      ...classifyVehicleState(NO_FACTS, null),
      activity: 'PARKED' as const,
      lastReportedAt: new Date('2026-10-18T06:00:00.000Z'),
    };
    const first = listRow({ state: parked, openAlertCount: 1 }),
      second = listRow({ openAlertCount: 3 });
    list.mockResolvedValue({ items: [first, second], total: 2 });
    const nextService = {
      id: randomUUID(),
      branchId: context.branchId,
      vehicleId: first.id,
      vehicle: {
        id: first.id,
        licensePlate: first.licensePlate,
        fleetNumber: null,
        vehicleType: null,
        status: 'ACTIVE' as const,
      },
      serviceType: 'OIL_CHANGE' as const,
      status: 'PLANNED' as const,
      dueOn: '2026-10-09',
      urgency: 'OVERDUE' as const,
      remainingDays: -9,
      createdAt: first.createdAt,
      updatedAt: first.updatedAt,
    };
    nextForVehicles.mockResolvedValue(new Map([[first.id, nextService]]));
    const page = await service.list(context, { filter: { hasOpenAlerts: true } });
    expect(list).toHaveBeenLastCalledWith(
      scope,
      { offset: 0, limit: 20 },
      expect.objectContaining({ hasOpenAlerts: true }),
      { field: 'CREATED_AT', direction: 'DESC' },
    );
    expect(vehicleStates).not.toHaveBeenCalled();
    expect(openAlertCounts).not.toHaveBeenCalled();
    expect(nextForVehicles).toHaveBeenCalledTimes(1);
    expect(nextForVehicles).toHaveBeenCalledWith(scope, [first.id, second.id]);
    expect(page.items).toMatchObject([
      { id: first.id, state: parked, openAlertCount: 1, nextService },
      {
        id: second.id,
        state: { activity: 'NO_DEVICE', fuelStatus: 'NO_DATA' },
        openAlertCount: 3,
        nextService: null,
      },
    ]);
    list.mockResolvedValue({ items: [], total: 0 });
    nextForVehicles.mockClear();
    await service.list(context, {});
    expect(vehicleStates).not.toHaveBeenCalled();
    expect(openAlertCounts).not.toHaveBeenCalled();
    expect(nextForVehicles).not.toHaveBeenCalled();
  });

  it('maps filters, tokens and sorting without checking Core', async () => {
    const page = await service.list(context, {
      offset: 20,
      limit: 10,
      search: ' CA  77 ',
      filter: {
        statuses: ['ACTIVE', 'IN_WORKSHOP'],
        vehicleTypes: ['TRACTOR'],
        fuelTypes: null,
        groupIds: [groupId.toUpperCase()],
        hasGroup: true,
        currentDriverIds: null,
        hasDriver: false,
        hasDevice: true,
      },
      sort: { field: 'FLEET_NUMBER', direction: 'ASC' },
    });
    expect(list).toHaveBeenLastCalledWith(
      scope,
      { offset: 20, limit: 10 },
      {
        tokens: ['CA', '77'],
        ids: undefined,
        statuses: ['ACTIVE', 'IN_WORKSHOP'],
        vehicleTypes: ['TRACTOR'],
        fuelTypes: undefined,
        groupIds: [groupId],
        hasGroup: true,
        currentDriverIds: undefined,
        hasDriver: false,
        hasDevice: true,
        hasOpenAlerts: undefined,
      },
      { field: 'FLEET_NUMBER', direction: 'ASC' },
    );
    expect(page).toMatchObject({ total: 1, offset: 20, limit: 10, items: [{ deviceCount: 2 }] });
    await service.list(context, {});
    expect(list).toHaveBeenLastCalledWith(
      scope,
      { offset: 0, limit: 20 },
      expect.objectContaining({ tokens: [], statuses: undefined }),
      { field: 'CREATED_AT', direction: 'DESC' },
    );
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('rejects invalid list arguments on their top-level paths before reading', async () => {
    expect(await fieldErrors(service.list(context, { filter: { statuses: [] } }))).toMatchObject([
      { path: 'filter' },
    ]);
    expect(
      await fieldErrors(service.list(context, { filter: { groupIds: ['not-a-uuid'] } })),
    ).toMatchObject([{ path: 'filter' }]);
    expect(await fieldErrors(service.list(context, { search: 'a b c d e f' }))).toMatchObject([
      { path: 'search' },
    ]);
    // GraphQL coerces enums; a direct call with an unknown value still fails on `sort`.
    for (const [key, value] of [
      ['field', 'VIN'],
      ['direction', 'UP'],
    ]) {
      const sort = { field: 'CREATED_AT' as const, direction: 'ASC' as const };
      Reflect.set(sort, key ?? '', value);
      expect(await fieldErrors(service.list(context, { sort }))).toMatchObject([{ path: 'sort' }]);
    }
    await expect(service.list({ ...context, branchId: 'bad' }, {})).rejects.toThrow(
      BadRequestException,
    );
    for (const args of [{ offset: -1 }, { limit: 101 }]) {
      await expect(service.list(context, args)).rejects.toThrow(BadRequestException);
    }
    expect(list).not.toHaveBeenCalled();
  });

  it('preserves repeated conditions and validates their bounds before reading', async () => {
    await service.list(context, {
      filter: {
        allOf: [
          { activities: ['MOVING'] },
          { excludedActivities: ['NO_DEVICE'] },
          { modelYearAbove: 2020 },
          { modelYearBelow: 2024 },
          { makeContains: ' VOLVO ' },
          { createdOnFrom: '2026-10-01', createdOnTo: '2026-10-18' },
        ],
      },
      sort: { field: 'ODOMETER_KM', direction: 'DESC' },
    });
    expect(list).toHaveBeenCalledWith(
      scope,
      { offset: 0, limit: 20 },
      expect.objectContaining({
        allOf: [
          expect.objectContaining({ activities: ['MOVING'] }),
          expect.objectContaining({ excludedActivities: ['NO_DEVICE'] }),
          expect.objectContaining({ modelYearAbove: 2020 }),
          expect.objectContaining({ modelYearBelow: 2024 }),
          expect.objectContaining({ makeContains: 'VOLVO' }),
          expect.objectContaining({ createdOnFrom: '2026-10-01', createdOnTo: '2026-10-18' }),
        ],
      }),
      { field: 'ODOMETER_KM', direction: 'DESC' },
    );
    list.mockClear();
    for (const allOf of [
      [{ modelYearAbove: 1900 }],
      [{ odometerKmFrom: 20, odometerKmTo: 10 }],
      [{ modelYearFrom: 2024, modelYearTo: 2020 }],
      [{ makeContains: '\u0000' }],
      [{ excludedGroupIds: ['bad'] }],
      [{ statuses: [] }],
      [{ createdOnAfter: '2026-02-30' }],
      [{ createdOnFrom: '2026-10-18', createdOnTo: '2026-10-01' }],
      Array.from({ length: 51 }, () => ({ hasDriver: true })),
    ]) {
      expect(await fieldErrors(service.list(context, { filter: { allOf } }))).toMatchObject([
        { path: 'filter' },
      ]);
    }
    expect(list).not.toHaveBeenCalled();
  });

  it('reports a driver deactivated before the locked create or update as unavailable', async () => {
    const id = randomUUID();
    find.mockResolvedValue(row({ id }));
    create.mockResolvedValue(null);
    update.mockResolvedValue(null);
    const expected = [
      {
        path: 'currentDriverId',
        message: 'Choose an active driver in this branch.',
        code: 'DRIVER_UNAVAILABLE',
      },
    ];
    expect(
      await fieldErrors(
        service.create(context, {
          licensePlate: 'CA1234AB',
          currentDriverId: driverId,
        }),
      ),
    ).toEqual(expected);
    expect(await fieldErrors(service.update(context, id, { currentDriverId: driverId }))).toEqual(
      expected,
    );
    expect(requireBranch).toHaveBeenCalledTimes(1);
    expect(vehicleStates).not.toHaveBeenCalled();
  });

  it('reads a whole-Branch summary with the verified scope and no Core lookup', async () => {
    summary.mockResolvedValue({
      dataAsOf: null,
      inOperation: 4,
      inWorkshop: 1,
      moving: 2,
      notReporting: 1,
      openAlerts: 3,
      lowFuel: 1,
    });
    await expect(service.summary(context)).resolves.toMatchObject({
      inOperation: 4,
      openAlerts: 3,
    });
    expect(summary).toHaveBeenCalledWith(scope);
    expect(requireBranch).not.toHaveBeenCalled();
    expect(() => service.summary({ ...context, branchId: 'bad' })).toThrow(BadRequestException);
  });

  it('returns mixed batch failures and continues submitted work in the captured scope', async () => {
    const selected = [randomUUID(), randomUUID(), randomUUID()];
    const [first = '', missing = '', last = ''] = selected;
    deactivate.mockImplementation((_scope, id) =>
      id === missing
        ? Promise.reject(
            new Prisma.PrismaClientKnownRequestError('missing', {
              code: 'P2025',
              clientVersion: '7',
            }),
          )
        : Promise.resolve(row({ id, status: 'INACTIVE' })),
    );
    await expect(service.deactivateMany(context, selected)).resolves.toEqual({
      succeededIds: [first, last],
      failures: [{ id: missing, code: 'NOT_FOUND', message: 'Vehicle not found' }],
    });
    for (const id of selected) {
      expect(deactivate).toHaveBeenCalledWith(scope, id);
    }
    remove.mockImplementation((_scope, id) =>
      id === first
        ? Promise.reject(
            new Prisma.PrismaClientKnownRequestError('history', {
              code: 'P2003',
              clientVersion: '7',
            }),
          )
        : Promise.resolve(row({ id })),
    );
    await expect(service.deleteMany(context, selected)).resolves.toEqual({
      succeededIds: [missing, last],
      failures: [
        {
          id: first,
          code: 'CONFLICT',
          message: 'Vehicle has devices or history; deactivate it instead.',
        },
      ],
    });
    for (const values of [
      [],
      [first, first],
      ['bad'],
      Array.from({ length: 101 }, () => randomUUID()),
    ]) {
      expect(await fieldErrors(service.deleteMany(context, values))).toMatchObject([
        { path: 'ids' },
      ]);
    }
    expect(remove).toHaveBeenCalledTimes(3);
    selected.forEach((id, index) => {
      expect(deactivate).toHaveBeenNthCalledWith(index + 1, scope, id);
      expect(remove).toHaveBeenNthCalledWith(index + 1, scope, id);
    });
    expect(vehicleStates).not.toHaveBeenCalled();
    expect(openAlertCounts).not.toHaveBeenCalled();
    expect(nextForVehicles).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('still hydrates public single deactivation and deletion responses', async () => {
    const inactive = row({ status: 'INACTIVE' });
    const deleted = row();
    deactivate.mockResolvedValue(inactive);
    remove.mockResolvedValue(deleted);
    openAlertCounts.mockResolvedValue(
      new Map([
        [inactive.id, 3],
        [deleted.id, 2],
      ]),
    );
    await expect(service.deactivate(context, inactive.id)).resolves.toMatchObject({
      id: inactive.id,
      status: 'INACTIVE',
      state: classifyVehicleState(NO_FACTS, null),
      openAlertCount: 3,
      nextService: null,
    });
    await expect(service.delete(context, deleted.id)).resolves.toMatchObject({
      id: deleted.id,
      state: classifyVehicleState(NO_FACTS, null),
      openAlertCount: 2,
      nextService: null,
    });
    for (const [index, id] of [inactive.id, deleted.id].entries()) {
      expect(vehicleStates).toHaveBeenNthCalledWith(index + 1, scope, [id]);
      expect(openAlertCounts).toHaveBeenNthCalledWith(index + 1, scope, [id]);
      expect(nextForVehicles).toHaveBeenNthCalledWith(index + 1, scope, [id]);
    }
  });

  it('creates with defaults, normalised VIN and scoped relation checks, calling Core once', async () => {
    await service.create(context, {
      licensePlate: ' CA1234AB ',
      notes: ' First line\nSecond line ',
      fleetNumber: ' T-01 ',
      vin: ' wdb9634031l123456 ',
      modelYear: 2021,
      fuelTankCapacityL: 400,
      groupId,
      currentDriverId: driverId,
    });
    expect(findGroup).toHaveBeenCalledWith(scope, groupId);
    expect(findDriver).toHaveBeenCalledWith(scope, driverId);
    expect(duplicates).toHaveBeenCalledWith(
      scope,
      { fleetNumber: 'T-01', vin: 'WDB9634031L123456' },
      null,
    );
    expect(requireBranch).toHaveBeenCalledTimes(1);
    expect(requireBranch).toHaveBeenCalledWith(context.branchId, context);
    expect(create).toHaveBeenCalledWith(scope, {
      licensePlate: 'CA1234AB',
      notes: 'First line\nSecond line',
      fleetNumber: 'T-01',
      vehicleType: null,
      make: null,
      model: null,
      modelYear: 2021,
      vin: 'WDB9634031L123456',
      fuelType: null,
      fuelTankCapacityL: 400,
      status: 'ACTIVE',
      groupId,
      currentDriverId: driverId,
    });
  });

  it.each([
    [{ licensePlate: '' }, 'licensePlate'],
    [{ licensePlate: 'A'.repeat(33) }, 'licensePlate'],
    [{ licensePlate: 'A\u0000' }, 'licensePlate'],
    [{ licensePlate: 'CA', notes: '😀'.repeat(2001) }, 'notes'],
    [{ licensePlate: 'CA', fleetNumber: 'F'.repeat(17) }, 'fleetNumber'],
    [{ licensePlate: 'CA', vin: 'WDB9634031L12345O' }, 'vin'],
    [{ licensePlate: 'CA', vin: 'WDB9634031L12345' }, 'vin'],
    [{ licensePlate: 'CA', modelYear: 1949 }, 'modelYear'],
    [{ licensePlate: 'CA', modelYear: 2101 }, 'modelYear'],
    [{ licensePlate: 'CA', fuelTankCapacityL: 0 }, 'fuelTankCapacityL'],
    [{ licensePlate: 'CA', fuelTankCapacityL: 2001 }, 'fuelTankCapacityL'],
    [{ licensePlate: 'CA', make: 'M'.repeat(65) }, 'make'],
    [{ licensePlate: 'CA', groupId: 'group' }, 'groupId'],
  ])('rejects %j on %s without Core calls or writes', async (input, path) => {
    expect(await fieldErrors(service.create(context, input))).toMatchObject([{ path }]);
    expect(create).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('rejects foreign or inactive relations and INACTIVE with a driver', async () => {
    findGroup.mockResolvedValueOnce(null);
    expect(
      await fieldErrors(service.create(context, { licensePlate: 'CA', groupId })),
    ).toMatchObject([{ path: 'groupId' }]);
    findDriver.mockResolvedValueOnce({ id: driverId, status: 'INACTIVE' });
    expect(
      await fieldErrors(service.create(context, { licensePlate: 'CA', currentDriverId: driverId })),
    ).toMatchObject([{ path: 'currentDriverId' }]);
    expect(
      await fieldErrors(
        service.create(context, {
          licensePlate: 'CA',
          status: 'INACTIVE',
          currentDriverId: driverId,
        }),
      ),
    ).toEqual([
      {
        path: 'currentDriverId',
        message: 'Unassign the driver before deactivating the vehicle.',
        code: 'DRIVER_ASSIGNED',
      },
    ]);
    expect(create).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('reports every duplicated unique field in one error', async () => {
    duplicates.mockResolvedValue({ fleetNumber: true, vin: true });
    expect(
      await fieldErrors(
        service.create(context, {
          licensePlate: 'CA',
          fleetNumber: 'T-01',
          vin: 'WDB9634031L123456',
        }),
      ),
    ).toEqual([
      {
        path: 'fleetNumber',
        message: 'Fleet number is already used in this branch.',
        code: 'ALREADY_EXISTS',
      },
      { path: 'vin', message: 'VIN is already used in this branch.', code: 'ALREADY_EXISTS' },
    ]);
    expect(create).not.toHaveBeenCalled();
  });

  it('maps a concurrent unique violation by index name', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '7',
        meta: {
          driverAdapterError: new Error('Unique', {
            cause: { constraint: { index: 'Vehicle_tenantId_branchId_vin_key' } },
          }),
        },
      }),
    );
    expect(
      await fieldErrors(service.create(context, { licensePlate: 'CA', vin: 'WDB9634031L123456' })),
    ).toEqual([
      { path: 'vin', message: 'VIN is already used in this branch.', code: 'ALREADY_EXISTS' },
    ]);
  });

  it.each(['ACTIVE', 'INACTIVE'] as const)(
    'reports an inactive Vehicle when assignment fails from a %s preflight state',
    async (status) => {
      const vehicle = row({ status });
      find.mockResolvedValue(vehicle);
      update.mockResolvedValue({ inactiveAssignment: true });
      expect(
        await fieldErrors(service.update(context, vehicle.id, { currentDriverId: driverId })),
      ).toEqual([
        {
          path: 'currentDriverId',
          message: 'Reactivate the vehicle before assigning a driver.',
          code: 'VEHICLE_INACTIVE',
        },
      ]);
      expect(update).toHaveBeenCalledTimes(status === 'ACTIVE' ? 1 : 0);
      if (status === 'ACTIVE') {
        expect(update).toHaveBeenCalledWith(scope, vehicle.id, { currentDriverId: driverId });
      }
      expect(requireBranch).not.toHaveBeenCalled();
    },
  );

  it('validates the merged row on update and never calls Core', async () => {
    const id = randomUUID();
    find.mockResolvedValue(row({ id, currentDriverId: driverId }));
    expect(await fieldErrors(service.update(context, id, { status: 'INACTIVE' }))).toMatchObject([
      { path: 'currentDriverId' },
    ]);
    await service.update(context, id, { status: 'INACTIVE', currentDriverId: null });
    expect(update).toHaveBeenLastCalledWith(scope, id, {
      status: 'INACTIVE',
      currentDriverId: null,
    });
    await service.update(context, id, { notes: null, vin: null });
    expect(update).toHaveBeenLastCalledWith(scope, id, { notes: null, vin: null });
    expect(duplicates).not.toHaveBeenCalled();
    await service.update(context, id, { fleetNumber: 'T-02' });
    expect(duplicates).toHaveBeenLastCalledWith(scope, { fleetNumber: 'T-02', vin: null }, id);
    for (const input of [{ licensePlate: null }, { status: null }]) {
      expect(await fieldErrors(service.update(context, id, input))).toHaveLength(1);
    }
    await expect(service.update(context, id, {})).rejects.toThrow(
      'Provide at least one vehicle field to update',
    );
    find.mockResolvedValue(null);
    await expect(service.update(context, id, { notes: 'x' })).rejects.toThrow(NotFoundException);
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('deactivates idempotently and protects deletion of vehicles with history', async () => {
    const id = randomUUID();
    deactivate.mockResolvedValue(row({ id, status: 'INACTIVE' }));
    await expect(service.deactivate(context, id)).resolves.toMatchObject({ status: 'INACTIVE' });
    expect(deactivate).toHaveBeenCalledWith(scope, id);
    remove.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK', { code: 'P2003', clientVersion: '7' }),
    );
    await expect(service.delete(context, id)).rejects.toThrow(
      new ConflictException('Vehicle has devices or history; deactivate it instead.'),
    );
    deactivate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Missing', { code: 'P2025', clientVersion: '7' }),
    );
    await expect(service.deactivate(context, id)).rejects.toThrow(NotFoundException);
  });
});
