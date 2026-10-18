import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { FleetClock } from '../../clock/fleet-clock.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { CreateFleetDeviceInput } from '../../generated/graphql/types.js';
import type { FleetDeviceModel, FleetDeviceOption } from '../../generated/prisma/enums.js';
import { reportingPair, TelemetryService } from '../telemetry/telemetry.service.js';
import { type DeviceRow, DevicesRepository } from './devices.repository.js';
import { DevicesService } from './devices.service.js';

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

describe('Devices validation and scope', () => {
  const list = jest.fn<DevicesRepository['list']>();
  const find = jest.fn<DevicesRepository['find']>();
  const create = jest.fn<DevicesRepository['create']>();
  const update = jest.fn<DevicesRepository['update']>();
  const findVehicle = jest.fn<DevicesRepository['findVehicle']>();
  const imeiTaken = jest.fn<DevicesRepository['imeiTaken']>();
  const requireBranch = jest.fn<CoreClient['requireBranch']>();
  const lastReported = jest.fn<TelemetryService['lastReported']>();
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
  function row(overrides: Partial<DeviceRow> = {}): DeviceRow {
    return {
      id: randomUUID(),
      tenantId: context.tenantId,
      branchId: context.branchId,
      imei: '001234567890123',
      vehicleId,
      vehicle: {
        id: vehicleId,
        licensePlate: 'CA1234AB',
        fleetNumber: null,
        vehicleType: null,
        status: 'ACTIVE',
      },
      model: null,
      options: [],
      firmwareVersion: null,
      simPhoneNumber: null,
      simIccid: null,
      installedAt: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }
  let service: DevicesService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DevicesService,
        {
          provide: DevicesRepository,
          useValue: { list, find, create, update, findVehicle, imeiTaken },
        },
        { provide: CoreClient, useValue: { requireBranch } },
        { provide: FleetClock, useValue: { now: () => now } },
        { provide: TelemetryService, useValue: { lastReported } },
      ],
    }).compile();
    service = module.get(DevicesService);
    jest.resetAllMocks();
    findVehicle.mockResolvedValue({ id: vehicleId });
    imeiTaken.mockResolvedValue(false);
    list.mockResolvedValue({ items: [row()], total: 1 });
    create.mockResolvedValue(row());
    update.mockResolvedValue(row());
    find.mockResolvedValue(row());
    lastReported.mockResolvedValue(new Map());
  });

  it('attaches lastReportedAt of each current (vehicle, IMEI) pair with one batched call', async () => {
    const reporting = row({ imei: '001234567890111' }),
      silent = row({ imei: '001234567890222' });
    list.mockResolvedValue({ items: [reporting, silent], total: 2 });
    const reportedAt = new Date('2026-10-18T06:25:00.000Z');
    lastReported.mockResolvedValue(
      new Map([[reportingPair(vehicleId, '001234567890111'), reportedAt]]),
    );
    const page = await service.list(context, {});
    expect(lastReported).toHaveBeenCalledTimes(1);
    expect(lastReported).toHaveBeenCalledWith(scope, [
      { vehicleId, imei: '001234567890111' },
      { vehicleId, imei: '001234567890222' },
    ]);
    expect(page.items.map((item) => item.lastReportedAt)).toEqual([reportedAt, null]);
  });

  it('maps tokens, filters and sorting without checking Core', async () => {
    const page = await service.list(context, {
      search: ' 001 CA ',
      filter: { models: ['STARLINK_TRACKER'], options: ['CAN', 'WIFI'], vehicleIds: [vehicleId] },
      sort: { field: 'INSTALLED_AT', direction: 'ASC' },
    });
    expect(list).toHaveBeenCalledWith(
      scope,
      { offset: 0, limit: 20 },
      {
        tokens: ['001', 'CA'],
        ids: undefined,
        models: ['STARLINK_TRACKER'],
        options: ['CAN', 'WIFI'],
        vehicleIds: [vehicleId],
      },
      { field: 'INSTALLED_AT', direction: 'ASC' },
    );
    expect(page.items[0]?.vehicle).toEqual({
      id: vehicleId,
      licensePlate: 'CA1234AB',
      fleetNumber: null,
      vehicleType: null,
      status: 'ACTIVE',
    });
    await expect(service.list(context, { limit: 101 })).rejects.toThrow(BadRequestException);
    await expect(service.list({ ...context, branchId: 'bad' }, {})).rejects.toThrow(
      BadRequestException,
    );
    expect(await fieldErrors(service.list(context, { filter: { options: [] } }))).toMatchObject([
      { path: 'filter' },
    ]);
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('preserves leading zeros, stores options in enum order and checks the vehicle first', async () => {
    await service.create(context, {
      imei: ' 001234567890123 ',
      vehicleId,
      model: 'STARLINK_TRACKER',
      options: ['WIFI', 'CAN', 'CELLULAR_4G'],
      firmwareVersion: ' 2.26.1_b-7 ',
      simPhoneNumber: '+359888123456',
      simIccid: '8935901990012345678',
      installedAt: '2026-10-18T09:59:59+03:00',
      notes: ' Cab ',
    });
    expect(findVehicle).toHaveBeenCalledWith(scope, vehicleId);
    expect(imeiTaken).toHaveBeenCalledWith(scope, '001234567890123', null);
    expect(requireBranch).toHaveBeenCalledWith(context.branchId, context);
    expect(create).toHaveBeenCalledWith(scope, {
      imei: '001234567890123',
      vehicleId,
      model: 'STARLINK_TRACKER',
      options: ['CELLULAR_4G', 'CAN', 'WIFI'],
      firmwareVersion: '2.26.1_b-7',
      simPhoneNumber: '+359888123456',
      simIccid: '8935901990012345678',
      installedAt: new Date('2026-10-18T06:59:59.000Z'),
      notes: 'Cab',
    });
  });

  const tracker: FleetDeviceOption[] = [
    'CELLULAR_4G',
    'SAFETY_SF',
    'IRF',
    'CAN',
    'DRIVER_ID',
    'ECONNECT',
    'RS232',
    'EXTERNAL_ANTENNA',
    'VOICE',
    'WIFI',
    'WILIOT',
  ];
  const scout: FleetDeviceOption[] = [
    'CELLULAR_4G',
    'SAFETY_SF',
    'TEMPERATURE_DS',
    'GEOZONES_GO',
    'IRF',
  ];
  const every: FleetDeviceOption[] = [...new Set([...tracker, ...scout])];
  it.each([
    ['STARLINK_TRACKER', tracker],
    ['STARLINK_SCOUT', scout],
    ['OTHER', every],
  ] satisfies [FleetDeviceModel, FleetDeviceOption[]][])(
    'accepts exactly the options supported by %s',
    async (model, supported) => {
      for (const option of every) {
        const result = service.create(context, {
          imei: '001234567890123',
          vehicleId,
          model,
          options: [option],
        });
        if (supported.includes(option)) await expect(result).resolves.toBeDefined();
        else expect(await fieldErrors(result)).toMatchObject([{ path: 'options' }]);
      }
    },
  );

  it('rejects options without a model and validates the merged row on update', async () => {
    expect(
      await fieldErrors(
        service.create(context, { imei: '001234567890123', vehicleId, options: ['CAN'] }),
      ),
    ).toMatchObject([{ path: 'options' }]);
    const id = randomUUID();
    find.mockResolvedValue(row({ id, model: 'STARLINK_TRACKER', options: ['CAN'] }));
    expect(
      await fieldErrors(service.update(context, id, { model: 'STARLINK_SCOUT' })),
    ).toMatchObject([{ path: 'options' }]);
    expect(await fieldErrors(service.update(context, id, { model: null }))).toMatchObject([
      { path: 'options' },
    ]);
    await service.update(context, id, { model: null, options: null });
    expect(update).toHaveBeenLastCalledWith(scope, id, { model: null, options: [] });
    await service.update(context, id, { options: ['WIFI'] });
    expect(update).toHaveBeenLastCalledWith(scope, id, { options: ['WIFI'] });
  });

  it.each([
    [{ simPhoneNumber: '12345' }, 'simPhoneNumber'],
    [{ simPhoneNumber: '35988812345678901234' }, 'simPhoneNumber'],
    [{ simPhoneNumber: '359 888' }, 'simPhoneNumber'],
    [{ simIccid: '12345678901234567' }, 'simIccid'],
    [{ simIccid: '1234567890123456789A' }, 'simIccid'],
    [{ firmwareVersion: '2.26 beta' }, 'firmwareVersion'],
    [{ firmwareVersion: 'v'.repeat(33) }, 'firmwareVersion'],
    [{ installedAt: '2026-10-18T07:00:00.001Z' }, 'installedAt'],
    [{ installedAt: '1999-12-31T23:59:59Z' }, 'installedAt'],
    [{ installedAt: '2026-10-18' }, 'installedAt'],
    [{ notes: 'n'.repeat(2001) }, 'notes'],
    [{ options: ['CAN', 'CAN'] }, 'options'],
  ] satisfies [Partial<CreateFleetDeviceInput>, string][])(
    'rejects %j on %s before writing',
    async (fields, path) => {
      expect(
        await fieldErrors(
          service.create(context, {
            imei: '001234567890123',
            vehicleId,
            model: 'OTHER',
            ...fields,
          }),
        ),
      ).toMatchObject([{ path }]);
      expect(create).not.toHaveBeenCalled();
      expect(requireBranch).not.toHaveBeenCalled();
    },
  );

  it.each([
    '',
    ' ',
    '12345678901234',
    '1234567890123456',
    '12345678901234A',
    '１２３４５６７８９０１２３４５',
  ])('rejects invalid IMEI %s before reads and writes', async (imei) => {
    await expect(service.create(context, { imei, vehicleId })).rejects.toThrow(BadRequestException);
    expect(findVehicle).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('rejects a missing or foreign vehicle in create and reassignment', async () => {
    findVehicle.mockResolvedValue(null);
    await expect(service.create(context, { imei: '001234567890123', vehicleId })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update(context, randomUUID(), { vehicleId })).rejects.toThrow(
      BadRequestException,
    );
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('reassigns without calling Core and rejects clearing required fields or empty updates', async () => {
    const id = randomUUID();
    await service.update(context, id, { vehicleId });
    expect(update).toHaveBeenCalledWith(scope, id, { vehicleId });
    await expect(service.update(context, id, { vehicleId: null })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update(context, id, { imei: null })).rejects.toThrow(BadRequestException);
    await expect(service.update(context, id, {})).rejects.toThrow(BadRequestException);
    find.mockResolvedValue(null);
    await expect(service.update(context, id, { notes: 'x' })).rejects.toThrow(NotFoundException);
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('reports a duplicate IMEI from the scoped pre-check and from a concurrent insert', async () => {
    imeiTaken.mockResolvedValueOnce(true);
    expect(
      await fieldErrors(service.create(context, { imei: '001234567890123', vehicleId })),
    ).toEqual([{ path: 'imei', message: 'IMEI is already used in this branch.' }]);
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '7',
        meta: {
          driverAdapterError: new Error('Unique', {
            cause: { constraint: { index: 'Device_tenantId_branchId_imei_key' } },
          }),
        },
      }),
    );
    expect(
      await fieldErrors(service.create(context, { imei: '001234567890123', vehicleId })),
    ).toEqual([{ path: 'imei', message: 'IMEI is already used in this branch.' }]);
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK', { code: 'P2003', clientVersion: '7' }),
    );
    expect(
      await fieldErrors(service.create(context, { imei: '001234567890123', vehicleId })),
    ).toMatchObject([{ path: 'vehicleId' }]);
  });
});
