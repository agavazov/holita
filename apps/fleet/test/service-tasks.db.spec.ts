import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
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
  const branchId = randomUUID();
  const vehicles = { a: '', b: '', c: '', d: '' };
  const tasks = new Map<TaskKey, string>();
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
      .useValue({
        requireBranch: jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined),
      })
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
      await client.serviceTask.create({
        data: {
          tenantId: scopeTenant,
          branchId: scopeBranch,
          vehicleId: vehicle.id,
          serviceType: 'OIL_CHANGE',
          title: 'Масло',
          dueOn: day('2026-10-01'),
        },
      });
    }
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
      expect({ row: key, value: await query(detail, { id: task(key) }) }).toMatchObject({
        row: key,
        value: { data: { fleetServiceTask: { urgency, remainingDays, remainingKm } } },
      });
    }
    // The default urgency order applies before paging and keeps the total.
    const urgencyOrder: TaskKey[] = [
      't10',
      't1',
      't4',
      't8',
      't2',
      't9',
      't5',
      't7',
      't3',
      't6',
      ...byIdDesc(['t11', 't12', 't13']),
    ];
    expect(await listed({})).toEqual(page(urgencyOrder));
    for (let offset = 0; offset < urgencyOrder.length; offset += 4) {
      expect({ row: offset, value: await listed({ offset, limit: 4 }) }).toEqual({
        row: offset,
        value: page(urgencyOrder.slice(offset, offset + 4), urgencyOrder.length, offset, 4),
      });
    }
    const filtered: [string, Record<string, unknown>, TaskKey[]][] = [
      ['unknown odometer', { filter: { urgencies: ['UNKNOWN_ODOMETER'] } }, ['t7']],
      [
        'overdue on one vehicle',
        { filter: { urgencies: ['OVERDUE'], vehicleIds: [vehicles.a] } },
        ['t1', 't4'],
      ],
      [
        'done by completion date',
        { filter: { statuses: ['DONE'] }, sort: { field: 'COMPLETED_ON', direction: 'DESC' } },
        ['t11', 't12'],
      ],
      [
        'closed completion range',
        { filter: { completedFrom: '2026-10-10', completedTo: '2026-10-10' } },
        ['t11'],
      ],
      ['completion upper bound', { filter: { completedTo: '2026-10-09' } }, ['t12']],
      ['title tokens', { search: 'масло филтри' }, ['t11']],
    ];
    for (const [row, variables, keys] of filtered) {
      expect({ row, value: await listed(variables) }).toEqual({ row, value: page(keys) });
    }
    // Active vehicles per task, workshop vehicles and the 30-day cost window.
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

    // Cost and urgency conditions filter and sort the complete scoped result.
    const parityBranch = randomUUID();
    const a = await database.client.vehicle.create({
      data: { tenantId, branchId: parityBranch, licensePlate: 'AA 001' },
    });
    const b = await database.client.vehicle.create({
      data: { tenantId, branchId: parityBranch, licensePlate: 'ZZ 001' },
    });
    const plan = await database.client.serviceTask.create({
      data: {
        tenantId,
        branchId: parityBranch,
        vehicleId: b.id,
        serviceType: 'OIL_CHANGE',
        title: 'Literal %_\\ task',
        notes: 'Find %_\\ here',
        dueOn: day('2026-10-20'),
      },
    });
    const free = await database.client.serviceTask.create({
      data: {
        tenantId,
        branchId: parityBranch,
        vehicleId: a.id,
        serviceType: 'BRAKES',
        status: 'DONE',
        completedOn: day('2026-10-17'),
        costCents: 0,
      },
    });
    const paid = await database.client.serviceTask.create({
      data: {
        tenantId,
        branchId: parityBranch,
        vehicleId: a.id,
        serviceType: 'REPAIR',
        title: 'Paid',
        status: 'DONE',
        completedOn: day('2026-10-16'),
        costCents: 12345,
      },
    });
    const cancelled = await database.client.serviceTask.create({
      data: {
        tenantId,
        branchId: parityBranch,
        vehicleId: b.id,
        serviceType: 'TIRES',
        status: 'CANCELLED',
      },
    });
    const conditions: [string, Record<string, unknown>, string[]][] = [
      [
        'exclusive cost bounds',
        { allOf: [{ costCentsAbove: 0 }, { costCentsBelow: 12346 }] },
        [paid.id],
      ],
      ['zero is a cost', { allOf: [{ hasCost: true }, { costCentsBelow: 1 }] }, [free.id]],
      ['repeated statuses', { allOf: [{ statuses: ['PLANNED'] }, { statuses: ['DONE'] }] }, []],
      ['literal task text', { allOf: [{ taskContains: '%_\\' }] }, [plan.id]],
      [
        'urgency exclusions keep rows without urgency',
        {
          allOf: [
            { excludedUrgencies: ['OVERDUE', 'DUE_SOON', 'UNKNOWN_ODOMETER', 'UPCOMING'] },
            { hasCost: false },
          ],
        },
        [cancelled.id],
      ],
    ];
    for (const [row, filter, ids] of conditions) {
      expect({
        row,
        value: await query(
          list,
          { filter, sort: { field: 'COST_CENTS', direction: 'ASC' }, offset: 0, limit: 100 },
          parityBranch,
        ),
      }).toEqual({
        row,
        value: {
          data: {
            fleetServiceTasks: {
              items: ids.map((id) => ({ id })),
              total: ids.length,
              offset: 0,
              limit: 100,
            },
          },
        },
      });
    }
    expect(
      await query(
        list,
        { sort: { field: 'COST_CENTS', direction: 'DESC' }, offset: 0, limit: 1 },
        parityBranch,
      ),
    ).toEqual({
      data: { fleetServiceTasks: { items: [{ id: paid.id }], total: 4, offset: 0, limit: 1 } },
    });
  });

  const fields =
    'id status serviceType title dueOn dueOdometerKm completedOn completedOdometerKm workshop replacedParts costCents urgency remainingDays remainingKm vehicle{id licensePlate}';
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
    // A failure while scheduling the next task rolls the completion back.
    const before = await database.client.serviceTask.count({ where: { tenantId, branchId } });
    expect(
      await query(complete, {
        id: task('t6'),
        input: { completedOn: '2026-10-18', nextDueOdometerKm: 110_000, nextTitle: 'FAIL' },
      }),
    ).toMatchObject({
      errors: [{ message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } }],
    });
    expect(
      await database.client.serviceTask.findUniqueOrThrow({ where: { id: task('t6') } }),
    ).toMatchObject({ status: 'PLANNED', completedOn: null });
    expect(await database.client.serviceTask.count({ where: { tenantId, branchId } })).toBe(before);
  });
});
