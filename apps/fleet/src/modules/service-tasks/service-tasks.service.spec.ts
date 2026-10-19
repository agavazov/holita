import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { FleetClock } from '../../clock/fleet-clock.js';
import type { CompleteFleetServiceTaskInput } from '../../generated/graphql/types.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { ServiceTasksRepository } from './service-tasks.repository.js';
import { ServiceTasksService } from './service-tasks.service.js';
import type { ServiceTaskRow } from './service-urgency.sql.js';

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

describe('Service task rules', () => {
  const list = jest.fn<ServiceTasksRepository['list']>();
  const findMany = jest.fn<ServiceTasksRepository['findMany']>();
  const nextForVehicles = jest.fn<ServiceTasksRepository['nextForVehicles']>();
  const urgencyCounts = jest.fn<ServiceTasksRepository['urgencyCounts']>();
  const completedTotals = jest.fn<ServiceTasksRepository['completedTotals']>();
  const countVehiclesInWorkshop = jest.fn<ServiceTasksRepository['countVehiclesInWorkshop']>();
  const vehicleRefs = jest.fn<ServiceTasksRepository['vehicleRefs']>();
  const findVehicle = jest.fn<ServiceTasksRepository['findVehicle']>();
  const findTask = jest.fn<ServiceTasksRepository['findTask']>();
  const highestCompletedOdometer = jest.fn<ServiceTasksRepository['highestCompletedOdometer']>();
  const create = jest.fn<ServiceTasksRepository['create']>();
  const updatePlanned = jest.fn<ServiceTasksRepository['updatePlanned']>();
  const complete = jest.fn<ServiceTasksRepository['complete']>();
  const cancelPlanned = jest.fn<ServiceTasksRepository['cancelPlanned']>();
  const deleteUncompleted = jest.fn<ServiceTasksRepository['deleteUncompleted']>();
  const requireBranch = jest.fn<CoreClient['requireBranch']>();
  // 22:30 UTC on 17 October is the business date 18 October in Europe/Sofia.
  const now = new Date('2026-10-17T22:30:00.000Z');
  const today = '2026-10-18';
  const context = {
    requestId: randomUUID(),
    tenantId: '01000000-0000-4000-8000-000000000001',
    branchId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map(),
  };
  const scope = { tenantId: context.tenantId, branchId: context.branchId };
  const vehicleId = randomUUID();
  const vehicle = {
    id: vehicleId,
    licensePlate: 'CB 1003 AX',
    fleetNumber: 'Т-03',
    vehicleType: 'TRACTOR' as const,
    status: 'ACTIVE' as const,
  };
  function task(overrides: Partial<ServiceTaskRow> = {}): ServiceTaskRow {
    return {
      id: randomUUID(),
      vehicleId,
      serviceType: 'OIL_CHANGE',
      status: 'PLANNED',
      title: 'Oil',
      dueOn: '2026-10-09',
      dueOdometerKm: null,
      completedOn: null,
      completedOdometerKm: null,
      workshop: 'Depot',
      replacedParts: null,
      costCents: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
      urgency: 'OVERDUE',
      remainingDays: -9,
      remainingKm: null,
      ...overrides,
    };
  }
  type StoredTask = NonNullable<Awaited<ReturnType<ServiceTasksRepository['findTask']>>>;
  function stored(overrides: Partial<StoredTask>): StoredTask {
    return {
      id: randomUUID(),
      vehicleId,
      serviceType: 'OIL_CHANGE' as const,
      status: 'PLANNED' as const,
      title: 'Oil',
      dueOn: new Date('2026-10-09T00:00:00.000Z'),
      dueOdometerKm: null,
      workshop: 'Depot',
      ...overrides,
    };
  }
  let service: ServiceTasksService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ServiceTasksService,
        {
          provide: ServiceTasksRepository,
          useValue: {
            list,
            findMany,
            nextForVehicles,
            urgencyCounts,
            completedTotals,
            countVehiclesInWorkshop,
            vehicleRefs,
            findVehicle,
            findTask,
            highestCompletedOdometer,
            create,
            updatePlanned,
            complete,
            cancelPlanned,
            deleteUncompleted,
          },
        },
        { provide: CoreClient, useValue: { requireBranch } },
        { provide: FleetClock, useValue: { now: () => now } },
      ],
    }).compile();
    service = module.get(ServiceTasksService);
    vehicleRefs.mockResolvedValue([vehicle]);
    findVehicle.mockResolvedValue({ id: vehicleId, status: 'ACTIVE' });
    findMany.mockImplementation((_scope, _today, ids) =>
      Promise.resolve(ids.map((id) => task({ id }))),
    );
    findTask.mockImplementation((_scope, id) => Promise.resolve(stored({ id })));
    create.mockResolvedValue(randomUUID());
    updatePlanned.mockResolvedValue(1);
    cancelPlanned.mockResolvedValue(1);
    deleteUncompleted.mockResolvedValue(1);
    highestCompletedOdometer.mockResolvedValue(null);
    complete.mockResolvedValue({ completed: 1, nextId: null });
  });

  it('lists with the urgency default sort, the business date and vehicle references', async () => {
    const row = task();
    list.mockResolvedValue({ items: [row], total: 1 });
    const page = await service.list(context, {
      search: 'Т-03 масло',
      filter: {
        statuses: ['PLANNED'],
        urgencies: ['OVERDUE', 'DUE_SOON'],
        serviceTypes: ['OIL_CHANGE'],
        vehicleIds: [vehicleId],
        completedFrom: '2026-10-01',
        completedTo: '2026-10-01',
      },
    });
    expect(list).toHaveBeenCalledWith(
      scope,
      today,
      { offset: 0, limit: 20 },
      {
        tokens: ['Т-03', 'масло'],
        ids: undefined,
        statuses: ['PLANNED'],
        urgencies: ['OVERDUE', 'DUE_SOON'],
        serviceTypes: ['OIL_CHANGE'],
        vehicleIds: [vehicleId],
        completedFrom: '2026-10-01',
        completedTo: '2026-10-01',
      },
      { field: 'URGENCY', direction: 'ASC' },
    );
    expect(page.items).toEqual([{ ...row, branchId: context.branchId, vehicle }]);
    expect(vehicleRefs).toHaveBeenCalledWith(scope, [vehicleId]);
    for (const filter of [
      { completedFrom: '2026-10-02', completedTo: '2026-10-01' },
      { urgencies: [] },
      { completedFrom: '2026-02-30' },
    ]) {
      expect(await fieldErrors(service.list(context, { filter }))).toMatchObject([
        { path: 'filter' },
      ]);
    }
  });

  it('creates planned tasks with a due date or odometer on active vehicles only', async () => {
    const id = randomUUID();
    create.mockResolvedValue(id);
    await expect(
      service.create(context, {
        vehicleId,
        serviceType: 'ANNUAL_INSPECTION',
        title: ' Годишен преглед ',
        dueOn: '2026-10-24',
        workshop: ' ',
      }),
    ).resolves.toMatchObject({ id, vehicle });
    expect(create).toHaveBeenCalledWith(scope, vehicleId, {
      serviceType: 'ANNUAL_INSPECTION',
      title: 'Годишен преглед',
      dueOn: new Date('2026-10-24T00:00:00.000Z'),
      dueOdometerKm: null,
      workshop: null,
      notes: null,
    });
    expect(requireBranch).toHaveBeenCalledTimes(1);
    for (const [input, path] of [
      [{}, 'dueOn'],
      [{ dueOn: '1999-12-31' }, 'dueOn'],
      [{ dueOn: '2101-01-01' }, 'dueOn'],
      [{ dueOdometerKm: 10_000_000 }, 'dueOdometerKm'],
      [{ dueOdometerKm: 1.5 }, 'dueOdometerKm'],
      [{ dueOn: '2026-11-01', title: 't'.repeat(121) }, 'title'],
      [{ dueOn: '2026-11-01', workshop: 'w'.repeat(129) }, 'workshop'],
      [{ dueOn: '2026-11-01', notes: 'n'.repeat(2001) }, 'notes'],
    ] satisfies [Record<string, unknown>, string][]) {
      expect(
        await fieldErrors(service.create(context, { vehicleId, serviceType: 'BRAKES', ...input })),
      ).toMatchObject([{ path }]);
    }
    findVehicle.mockResolvedValue({ id: vehicleId, status: 'INACTIVE' });
    expect(
      await fieldErrors(
        service.create(context, { vehicleId, serviceType: 'BRAKES', dueOdometerKm: 0 }),
      ),
    ).toMatchObject([{ path: 'vehicleId' }]);
    expect(requireBranch).toHaveBeenCalledTimes(1);
  });

  it('updates only planned tasks and keeps a due value on the merged row', async () => {
    const id = randomUUID();
    await service.update(context, id, { dueOdometerKm: 250_000, dueOn: null });
    expect(updatePlanned).toHaveBeenCalledWith(scope, id, { dueOn: null, dueOdometerKm: 250_000 });
    expect(await fieldErrors(service.update(context, id, { dueOn: null }))).toMatchObject([
      { path: 'dueOn' },
    ]);
    expect(await fieldErrors(service.update(context, id, { serviceType: null }))).toMatchObject([
      { path: 'serviceType' },
    ]);
    await expect(service.update(context, id, {})).rejects.toThrow(
      'Provide at least one service task field to update',
    );
    findTask.mockResolvedValueOnce(stored({ id, status: 'DONE' }));
    await expect(service.update(context, id, { title: 'x' })).rejects.toThrow(
      new ConflictException('Only planned service can be changed'),
    );
    // Completed by someone else between the read and the conditional write.
    updatePlanned.mockResolvedValueOnce(0);
    findTask
      .mockResolvedValueOnce(stored({ id }))
      .mockResolvedValueOnce(stored({ id, status: 'DONE' }));
    await expect(service.update(context, id, { title: 'x' })).rejects.toThrow(ConflictException);
    findTask.mockResolvedValueOnce(null);
    await expect(service.update(context, id, { title: 'x' })).rejects.toThrow(NotFoundException);
  });

  const completion: CompleteFleetServiceTaskInput = {
    completedOn: '2026-10-18',
    completedOdometerKm: 400_000,
    costCents: 0,
    replacedParts: 'Filter',
    nextDueOn: '2027-04-18',
    nextDueOdometerKm: 430_000,
  };

  it('completes and schedules the next task of the same vehicle and type', async () => {
    const id = randomUUID(),
      nextId = randomUUID();
    complete.mockResolvedValue({ completed: 1, nextId });
    await expect(service.complete(context, id, completion)).resolves.toMatchObject({
      completed: { id },
      next: { id: nextId },
    });
    expect(highestCompletedOdometer).toHaveBeenCalledWith(
      scope,
      vehicleId,
      new Date('2026-10-18T00:00:00.000Z'),
    );
    expect(complete).toHaveBeenCalledWith(
      scope,
      id,
      {
        completedOn: new Date('2026-10-18T00:00:00.000Z'),
        completedOdometerKm: 400_000,
        costCents: 0,
        replacedParts: 'Filter',
      },
      {
        vehicleId,
        plan: {
          serviceType: 'OIL_CHANGE',
          title: 'Oil',
          dueOn: new Date('2027-04-18T00:00:00.000Z'),
          dueOdometerKm: 430_000,
          workshop: 'Depot',
          notes: null,
        },
      },
    );
    await service.complete(context, id, {
      completedOn: '2026-10-17',
      workshop: null,
      notes: 'Done',
      nextDueOdometerKm: 10,
      nextTitle: 'Next oil',
    });
    expect(complete).toHaveBeenLastCalledWith(
      scope,
      id,
      expect.objectContaining({ workshop: null, notes: 'Done', completedOdometerKm: null }),
      { vehicleId, plan: expect.objectContaining({ title: 'Next oil', workshop: null }) },
    );
    await service.complete(context, id, { completedOn: '2026-10-18' });
    expect(complete).toHaveBeenLastCalledWith(
      scope,
      id,
      {
        completedOn: new Date('2026-10-18T00:00:00.000Z'),
        completedOdometerKm: null,
        costCents: null,
        replacedParts: null,
      },
      null,
    );
  });

  it.each([
    [{ completedOn: '2026-10-19' }, 'completedOn'],
    [{ completedOn: '1999-12-31' }, 'completedOn'],
    [{ completedOdometerKm: -1 }, 'completedOdometerKm'],
    [{ costCents: 100_000_001 }, 'costCents'],
    [{ replacedParts: 'p'.repeat(1001) }, 'replacedParts'],
    [{ nextDueOn: '2026-10-18' }, 'nextDueOn'],
    [{ nextDueOdometerKm: 400_000 }, 'nextDueOdometerKm'],
    [{ nextTitle: 't'.repeat(121) }, 'nextTitle'],
  ] satisfies [Partial<CompleteFleetServiceTaskInput>, string][])(
    'rejects completion %j on %s without writing',
    async (fields, path) => {
      expect(
        await fieldErrors(service.complete(context, randomUUID(), { ...completion, ...fields })),
      ).toMatchObject([{ path }]);
      expect(complete).not.toHaveBeenCalled();
    },
  );

  it('protects the completion odometer and the task status', async () => {
    const id = randomUUID();
    highestCompletedOdometer.mockResolvedValueOnce(400_001);
    expect(await fieldErrors(service.complete(context, id, completion))).toMatchObject([
      { path: 'completedOdometerKm' },
    ]);
    findTask.mockResolvedValueOnce(stored({ id, status: 'CANCELLED' }));
    await expect(service.complete(context, id, completion)).rejects.toThrow(
      new ConflictException('Only planned service can be completed'),
    );
    complete.mockResolvedValueOnce({ completed: 0, nextId: null });
    findTask
      .mockResolvedValueOnce(stored({ id }))
      .mockResolvedValueOnce(stored({ id, status: 'DONE' }));
    await expect(service.complete(context, id, completion)).rejects.toThrow(ConflictException);
    findTask.mockResolvedValueOnce(null);
    await expect(service.complete(context, id, completion)).rejects.toThrow(NotFoundException);
  });

  it('cancels planned tasks and deletes only planned or cancelled ones', async () => {
    const id = randomUUID();
    await expect(service.cancel(context, id)).resolves.toMatchObject({ id });
    cancelPlanned.mockResolvedValueOnce(0);
    findTask.mockResolvedValueOnce(stored({ id, status: 'DONE' }));
    await expect(service.cancel(context, id)).rejects.toThrow(ConflictException);
    cancelPlanned.mockResolvedValueOnce(0);
    findTask.mockResolvedValueOnce(null);
    await expect(service.cancel(context, id)).rejects.toThrow(NotFoundException);
    await expect(service.delete(context, id)).resolves.toMatchObject({ id });
    expect(deleteUncompleted).toHaveBeenCalledWith(scope, id);
    findMany.mockResolvedValueOnce([task({ id, status: 'DONE', urgency: null })]);
    await expect(service.delete(context, id)).rejects.toThrow(
      new ConflictException('Completed service is kept as history'),
    );
    findMany.mockResolvedValueOnce([]);
    await expect(service.delete(context, id)).rejects.toThrow(NotFoundException);
    expect(deleteUncompleted).toHaveBeenCalledTimes(1);
  });

  it('summarises urgencies, workshop vehicles and the 30-day cost window', async () => {
    urgencyCounts.mockResolvedValue({ overdue: 6, dueSoon: 7, unknownOdometer: 1, upcoming: 40 });
    countVehiclesInWorkshop.mockResolvedValue(4);
    completedTotals.mockResolvedValue({ count: 3, costCents: 125_000 });
    await expect(service.summary(context)).resolves.toEqual({
      businessDate: today,
      overdue: 6,
      dueSoon: 7,
      unknownOdometer: 1,
      upcoming: 40,
      inWorkshopVehicles: 4,
      completedLast30Days: 3,
      costLast30DaysCents: 125_000,
      costWindowStart: '2026-09-19',
      costWindowEnd: today,
    });
    expect(urgencyCounts).toHaveBeenCalledWith(scope, today);
    expect(completedTotals).toHaveBeenCalledWith(
      scope,
      new Date('2026-09-19T00:00:00.000Z'),
      new Date('2026-10-18T00:00:00.000Z'),
    );
  });

  it('returns the next service per vehicle from one query', async () => {
    const next = task();
    nextForVehicles.mockResolvedValue([next]);
    const result = await service.nextForVehicles(scope, [vehicleId, randomUUID()]);
    expect(nextForVehicles).toHaveBeenCalledWith(scope, today, expect.any(Array));
    expect(result.get(vehicleId)).toMatchObject({ id: next.id, vehicle });
    expect(result.size).toBe(1);
    expect(await service.nextForVehicles(scope, [])).toEqual(new Map());
    expect(nextForVehicles).toHaveBeenCalledTimes(1);
  });
});
