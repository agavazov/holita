import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { createTestDatabase } from './test-database.js';
import { getTestDatabaseUrl } from './test-database-url.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
// 22:30 UTC on 17 October is the business date 18 October 2026 in Europe/Sofia.
const now = new Date('2026-10-17T22:30:00.000Z');
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

type TaskKey =
  't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7' | 't8' | 't9' | 't10' | 't11' | 't12' | 't13';

describe('Service tasks and urgency with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const connection = new pg.Client({ connectionString: getTestDatabaseUrl() });
  let connected = false;
  const requireBranch = jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined);
  const branchId = randomUUID();
  const vehicles = { a: '', b: '', c: '', d: '' };
  const tasks = new Map<TaskKey, string>();
  let foreignTask = '';
  function task(key: TaskKey): string {
    const id = tasks.get(key);
    if (!id) {
      throw new Error(`Missing task ${key}`);
    }
    return id;
  }
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    await connection.connect();
    connected = true;
    await connection.query(`SET search_path TO ${pg.escapeIdentifier(database.schema)}`);
    // Forced failure for the atomic completion case: the next task insert raises.
    await connection.query(`CREATE FUNCTION fail_next_task() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."title" = 'FAIL' THEN RAISE EXCEPTION 'forced failure'; END IF;
        RETURN NEW;
      END $$`);
    await connection.query(
      'CREATE TRIGGER fail_next_task BEFORE INSERT ON "ServiceTask" FOR EACH ROW EXECUTE FUNCTION fail_next_task()',
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({ requireBranch })
      .overrideProvider(FleetClock)
      .useValue({ now: () => now })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
    const client = database.client;
    for (const [key, licensePlate, status] of [
      ['a', 'CB 2001 AX', 'ACTIVE'],
      ['b', 'CB 2002 AX', 'ACTIVE'],
      ['c', 'CB 2003 AX', 'INACTIVE'],
      ['d', 'CB 2004 AX', 'IN_WORKSHOP'],
    ] as const) {
      vehicles[key] = (
        await client.vehicle.create({ data: { tenantId, branchId, licensePlate, status } })
      ).id;
    }
    await client.vehicleStatusSample.createMany({
      data: [
        {
          tenantId,
          branchId,
          vehicleId: vehicles.a,
          deviceImei: '990601000000001',
          source: 'DEMO',
          recordedAt: day('2026-10-17'),
          receivedAt: day('2026-10-17'),
          odometerKm: 99_000,
        },
        {
          tenantId,
          branchId,
          vehicleId: vehicles.a,
          source: 'MANUAL',
          recordedAt: new Date('2026-10-17T12:00:00.000Z'),
          receivedAt: new Date('2026-10-17T12:00:00.000Z'),
          odometerKm: 100_000,
        },
        {
          tenantId,
          branchId,
          vehicleId: vehicles.c,
          source: 'MANUAL',
          recordedAt: day('2026-10-01'),
          receivedAt: day('2026-10-01'),
          odometerKm: 50_000,
        },
      ],
    });
    const rows: [TaskKey, Omit<Prisma.ServiceTaskUncheckedCreateInput, 'tenantId' | 'branchId'>][] =
      [
        ['t1', { vehicleId: vehicles.a, serviceType: 'OIL_CHANGE', dueOn: day('2026-10-17') }],
        [
          't2',
          {
            vehicleId: vehicles.a,
            serviceType: 'GENERAL_SERVICE',
            title: 'Обслужване',
            workshop: 'Депо',
            dueOn: day('2026-11-01'),
          },
        ],
        [
          't3',
          { vehicleId: vehicles.a, serviceType: 'ANNUAL_INSPECTION', dueOn: day('2026-11-02') },
        ],
        ['t4', { vehicleId: vehicles.a, serviceType: 'BRAKES', dueOdometerKm: 100_000 }],
        ['t5', { vehicleId: vehicles.a, serviceType: 'TIRES', dueOdometerKm: 101_500 }],
        ['t6', { vehicleId: vehicles.a, serviceType: 'REPAIR', dueOdometerKm: 101_501 }],
        ['t7', { vehicleId: vehicles.b, serviceType: 'GENERAL_SERVICE', dueOdometerKm: 20_000 }],
        [
          't8',
          {
            vehicleId: vehicles.b,
            serviceType: 'OIL_CHANGE',
            dueOn: day('2026-10-20'),
            dueOdometerKm: 20_000,
          },
        ],
        [
          't9',
          {
            vehicleId: vehicles.a,
            serviceType: 'TACHOGRAPH_CALIBRATION',
            dueOn: day('2026-12-31'),
            dueOdometerKm: 100_100,
          },
        ],
        ['t10', { vehicleId: vehicles.c, serviceType: 'OIL_CHANGE', dueOn: day('2026-10-01') }],
        [
          't11',
          {
            vehicleId: vehicles.a,
            serviceType: 'OIL_CHANGE',
            status: 'DONE',
            title: 'Масло и филтри',
            workshop: 'Сервиз Тракия',
            completedOn: day('2026-10-10'),
            completedOdometerKm: 95_000,
            costCents: 12_345,
          },
        ],
        [
          't12',
          {
            vehicleId: vehicles.a,
            serviceType: 'BRAKES',
            status: 'DONE',
            completedOn: day('2026-09-18'),
            costCents: 999,
          },
        ],
        ['t13', { vehicleId: vehicles.b, serviceType: 'TIRES', status: 'CANCELLED' }],
      ];
    for (const [index, [key, data]] of rows.entries()) {
      tasks.set(
        key,
        (
          await client.serviceTask.create({
            data: {
              ...data,
              tenantId,
              branchId,
              createdAt: new Date(Date.UTC(2026, 9, 1, index)),
            },
          })
        ).id,
      );
    }
    // Matching tasks of another Branch and another Tenant stay invisible and uncounted.
    for (const [scopeTenant, scopeBranch] of [
      [tenantId, randomUUID()],
      [randomUUID(), branchId],
    ] as const) {
      const vehicle = await client.vehicle.create({
        data: { tenantId: scopeTenant, branchId: scopeBranch, licensePlate: 'CB 2002 AX' },
      });
      foreignTask = (
        await client.serviceTask.create({
          data: {
            tenantId: scopeTenant,
            branchId: scopeBranch,
            vehicleId: vehicle.id,
            serviceType: 'OIL_CHANGE',
            title: 'Масло',
            dueOn: day('2026-10-01'),
          },
        })
      ).id;
    }
  });
  beforeEach(() => {
    requireBranch.mockClear();
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      try {
        if (connected) {
          await connection.end();
        }
      } finally {
        await closeDatabase?.();
      }
    }
  });
  async function query(source: string, variables: Record<string, unknown>, scope = branchId) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(tenantId)}`,
        'x-branch-id': scope,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  const list =
    'query($search:String,$filter:FleetServiceTaskFilter,$sort:FleetServiceTaskSort,$offset:Int!,$limit:Int!){fleetServiceTasks(search:$search,filter:$filter,sort:$sort,offset:$offset,limit:$limit){items{id}total offset limit}}';
  function page(keys: TaskKey[], total = keys.length, offset = 0, limit = 100) {
    return {
      data: {
        fleetServiceTasks: { items: keys.map((key) => ({ id: task(key) })), total, offset, limit },
      },
    };
  }
  async function listed(variables: Record<string, unknown>) {
    const body = await query(list, { offset: 0, limit: 100, ...variables });
    expect(body).not.toHaveProperty('errors');
    return body;
  }
  /** Tasks ordered by the final `id DESC` tie-break. */
  function byIdDesc(keys: TaskKey[]): TaskKey[] {
    return [...keys].sort((left, right) => (task(left) < task(right) ? 1 : -1));
  }

  it('derives urgency, remaining days and kilometres at the fixed business date', async () => {
    const detail =
      'query($id:ID!){fleetServiceTask(id:$id){status urgency remainingDays remainingKm vehicle{licensePlate}}}';
    const expected: [TaskKey, string | null, number | null, number | null][] = [
      ['t1', 'OVERDUE', -1, null],
      ['t2', 'DUE_SOON', 14, null],
      ['t3', 'UPCOMING', 15, null],
      ['t4', 'OVERDUE', null, 0],
      ['t5', 'DUE_SOON', null, 1500],
      ['t6', 'UPCOMING', null, 1501],
      ['t7', 'UNKNOWN_ODOMETER', null, null],
      ['t8', 'DUE_SOON', 2, null],
      ['t9', 'DUE_SOON', 74, 100],
      ['t10', 'OVERDUE', -17, null],
      ['t11', null, null, null],
      ['t13', null, null, null],
    ];
    for (const [key, urgency, remainingDays, remainingKm] of expected) {
      expect(await query(detail, { id: task(key) })).toMatchObject({
        data: { fleetServiceTask: { urgency, remainingDays, remainingKm } },
      });
    }
    expect(await query(detail, { id: foreignTask })).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
  });

  it('orders the raw list by every sort field and pages it consistently with its total', async () => {
    const unplanned = byIdDesc(['t11', 't12', 't13']);
    const undated = byIdDesc(['t4', 't5', 't6', 't7', 't11', 't12', 't13']);
    const uncompleted = byIdDesc([
      't1',
      't2',
      't3',
      't4',
      't5',
      't6',
      't7',
      't8',
      't9',
      't10',
      't13',
    ]);
    const created: TaskKey[] = [
      't1',
      't2',
      't3',
      't4',
      't5',
      't6',
      't7',
      't8',
      't9',
      't10',
      't11',
      't12',
      't13',
    ];
    const orders: [Record<string, string> | undefined, TaskKey[]][] = [
      [undefined, ['t10', 't1', 't4', 't8', 't2', 't9', 't5', 't7', 't3', 't6', ...unplanned]],
      [
        { field: 'URGENCY', direction: 'DESC' },
        ['t3', 't6', 't7', 't8', 't2', 't9', 't5', 't10', 't1', 't4', ...unplanned],
      ],
      [{ field: 'DUE_ON', direction: 'ASC' }, ['t10', 't1', 't8', 't2', 't3', 't9', ...undated]],
      [{ field: 'DUE_ON', direction: 'DESC' }, ['t9', 't3', 't2', 't8', 't1', 't10', ...undated]],
      [{ field: 'COMPLETED_ON', direction: 'DESC' }, ['t11', 't12', ...uncompleted]],
      [{ field: 'COMPLETED_ON', direction: 'ASC' }, ['t12', 't11', ...uncompleted]],
      [{ field: 'CREATED_AT', direction: 'ASC' }, created],
      [{ field: 'CREATED_AT', direction: 'DESC' }, [...created].reverse()],
    ];
    for (const [sort, keys] of orders) {
      expect(await listed({ sort })).toEqual(page(keys));
      for (let offset = 0; offset < keys.length; offset += 4) {
        expect(await listed({ sort, offset, limit: 4 })).toEqual(
          page(keys.slice(offset, offset + 4), keys.length, offset, 4),
        );
      }
    }
  });

  it('filters by urgency, status, type, vehicle and completion date and searches tasks and vehicles', async () => {
    expect(await listed({ filter: { urgencies: ['UNKNOWN_ODOMETER'] } })).toEqual(page(['t7']));
    expect(await listed({ filter: { urgencies: ['OVERDUE'], vehicleIds: [vehicles.a] } })).toEqual(
      page(['t1', 't4']),
    );
    expect(
      await listed({
        filter: { statuses: ['DONE'] },
        sort: { field: 'COMPLETED_ON', direction: 'DESC' },
      }),
    ).toEqual(page(['t11', 't12']));
    expect(
      await listed({ filter: { completedFrom: '2026-10-10', completedTo: '2026-10-10' } }),
    ).toEqual(page(['t11']));
    expect(await listed({ filter: { completedTo: '2026-10-09' } })).toEqual(page(['t12']));
    expect(await listed({ filter: { serviceTypes: ['TIRES'] } })).toEqual(page(['t5', 't13']));
    expect(await listed({ filter: { vehicleIds: [vehicles.b] } })).toEqual(
      page(['t8', 't7', 't13']),
    );
    expect(await listed({ search: 'cb 2002' })).toEqual(page(['t8', 't7', 't13']));
    expect(await listed({ search: 'ТРАКИЯ' })).toEqual(page(['t11']));
    expect(await listed({ search: 'масло филтри' })).toEqual(page(['t11']));
    expect(await listed({ search: '100%' })).toEqual(page([]));
    expect(
      await query(list, {
        offset: 0,
        limit: 20,
        filter: { completedFrom: '2026-10-11', completedTo: '2026-10-10' },
      }),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'filter' }] } }] });
  });

  it('summarises active vehicles per task, workshop vehicles and the 30-day cost window', async () => {
    const summary =
      '{fleetServiceSummary{businessDate overdue dueSoon unknownOdometer upcoming inWorkshopVehicles completedLast30Days costLast30DaysCents costWindowStart costWindowEnd}}';
    expect(await query(summary, {})).toEqual({
      data: {
        fleetServiceSummary: {
          businessDate: '2026-10-18',
          overdue: 2,
          dueSoon: 4,
          unknownOdometer: 1,
          upcoming: 2,
          inWorkshopVehicles: 1,
          completedLast30Days: 1,
          costLast30DaysCents: 12_345,
          costWindowStart: '2026-09-19',
          costWindowEnd: '2026-10-18',
        },
      },
    });
    expect(await query(summary, {}, randomUUID())).toMatchObject({
      data: { fleetServiceSummary: { overdue: 0, dueSoon: 0, costLast30DaysCents: 0 } },
    });
  });

  const fields =
    'id status serviceType title dueOn dueOdometerKm completedOn completedOdometerKm workshop replacedParts costCents urgency remainingDays remainingKm vehicle{id licensePlate}';

  it('creates and updates planned tasks only', async () => {
    const create = `mutation($input:CreateFleetServiceTaskInput!){createFleetServiceTask(input:$input){${fields}}}`;
    expect(
      await query(create, {
        input: {
          vehicleId: vehicles.b,
          serviceType: 'BRAKES',
          title: ' Нови накладки ',
          dueOdometerKm: 25_000,
        },
      }),
    ).toMatchObject({
      data: {
        createFleetServiceTask: {
          status: 'PLANNED',
          title: 'Нови накладки',
          urgency: 'UNKNOWN_ODOMETER',
          vehicle: { id: vehicles.b, licensePlate: 'CB 2002 AX' },
        },
      },
    });
    expect(requireBranch).toHaveBeenCalledTimes(1);
    for (const [input, path] of [
      [{ vehicleId: vehicles.c, serviceType: 'BRAKES', dueOn: '2026-11-01' }, 'vehicleId'],
      [{ vehicleId: foreignTask, serviceType: 'BRAKES', dueOn: '2026-11-01' }, 'vehicleId'],
      [{ vehicleId: vehicles.a, serviceType: 'BRAKES' }, 'dueOn'],
      [{ vehicleId: vehicles.a, serviceType: 'BRAKES', dueOn: '2026-02-30' }, 'dueOn'],
    ] satisfies [Record<string, unknown>, string][]) {
      expect(await query(create, { input })).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
      });
    }
    expect(requireBranch).toHaveBeenCalledTimes(1);
    const update = `mutation($id:ID!,$input:UpdateFleetServiceTaskInput!){updateFleetServiceTask(id:$id,input:$input){${fields}}}`;
    expect(await query(update, { id: task('t3'), input: { dueOn: '2026-10-25' } })).toMatchObject({
      data: {
        updateFleetServiceTask: { dueOn: '2026-10-25', urgency: 'DUE_SOON', remainingDays: 7 },
      },
    });
    expect(await query(update, { id: task('t3'), input: { dueOn: null } })).toMatchObject({
      errors: [{ extensions: { fieldErrors: [{ path: 'dueOn' }] } }],
    });
    expect(await query(update, { id: task('t11'), input: { title: 'x' } })).toMatchObject({
      errors: [
        { message: 'Only planned service can be changed', extensions: { code: 'CONFLICT' } },
      ],
    });
    expect(await query(update, { id: foreignTask, input: { title: 'x' } })).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
  });

  const complete = `mutation($id:ID!,$input:CompleteFleetServiceTaskInput!){completeFleetServiceTask(id:$id,input:$input){completed{${fields}} next{${fields}}}}`;

  it('completes a task and schedules the next one in the same transaction', async () => {
    expect(
      await query(complete, {
        id: task('t2'),
        input: {
          completedOn: '2026-10-18',
          completedOdometerKm: 100_000,
          costCents: 0,
          replacedParts: 'Филтър',
          nextDueOn: '2027-04-18',
          nextDueOdometerKm: 130_000,
        },
      }),
    ).toMatchObject({
      data: {
        completeFleetServiceTask: {
          completed: {
            id: task('t2'),
            status: 'DONE',
            completedOn: '2026-10-18',
            completedOdometerKm: 100_000,
            costCents: 0,
            replacedParts: 'Филтър',
            workshop: 'Депо',
            urgency: null,
          },
          next: {
            status: 'PLANNED',
            serviceType: 'GENERAL_SERVICE',
            title: 'Обслужване',
            workshop: 'Депо',
            dueOn: '2027-04-18',
            dueOdometerKm: 130_000,
            urgency: 'UPCOMING',
            vehicle: { id: vehicles.a },
          },
        },
      },
    });
    for (const [input, path] of [
      [{ completedOn: '2026-10-18', completedOdometerKm: 94_000 }, 'completedOdometerKm'],
      [{ completedOn: '2026-10-19' }, 'completedOn'],
      [{ completedOn: '2026-10-18', nextDueOn: '2026-10-18' }, 'nextDueOn'],
    ] satisfies [Record<string, unknown>, string][]) {
      expect(await query(complete, { id: task('t5'), input })).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
      });
    }
    expect(
      await query(complete, { id: task('t11'), input: { completedOn: '2026-10-18' } }),
    ).toMatchObject({
      errors: [
        { message: 'Only planned service can be completed', extensions: { code: 'CONFLICT' } },
      ],
    });
  });

  it('rolls back the completion when scheduling the next task fails', async () => {
    const before = await database.client.serviceTask.count({ where: { tenantId, branchId } });
    expect(
      await query(complete, {
        id: task('t6'),
        input: { completedOn: '2026-10-18', nextDueOdometerKm: 110_000, nextTitle: 'FAIL' },
      }),
    ).toMatchObject({ errors: [{ extensions: { code: 'INTERNAL_SERVER_ERROR' } }] });
    expect(
      await database.client.serviceTask.findUniqueOrThrow({ where: { id: task('t6') } }),
    ).toMatchObject({ status: 'PLANNED', completedOn: null });
    expect(await database.client.serviceTask.count({ where: { tenantId, branchId } })).toBe(before);
  });

  it('cancels planned tasks and deletes only planned or cancelled ones', async () => {
    const cancel = 'mutation($id:ID!){cancelFleetServiceTask(id:$id){id status urgency}}';
    const remove = 'mutation($id:ID!){deleteFleetServiceTask(id:$id){id status}}';
    expect(await query(cancel, { id: task('t7') })).toEqual({
      data: { cancelFleetServiceTask: { id: task('t7'), status: 'CANCELLED', urgency: null } },
    });
    expect(await query(cancel, { id: task('t7') })).toMatchObject({
      errors: [{ extensions: { code: 'CONFLICT' } }],
    });
    expect(await query(remove, { id: task('t7') })).toEqual({
      data: { deleteFleetServiceTask: { id: task('t7'), status: 'CANCELLED' } },
    });
    expect(await query(remove, { id: task('t8') })).toEqual({
      data: { deleteFleetServiceTask: { id: task('t8'), status: 'PLANNED' } },
    });
    expect(await query(remove, { id: task('t11') })).toMatchObject({
      errors: [
        { message: 'Completed service is kept as history', extensions: { code: 'CONFLICT' } },
      ],
    });
    for (const source of [cancel, remove]) {
      expect(await query(source, { id: foreignTask })).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    }
    expect(
      await database.client.serviceTask.findMany({
        where: { id: { in: [task('t7'), task('t8'), task('t11')] } },
        select: { id: true },
      }),
    ).toEqual([{ id: task('t11') }]);
  });
});
