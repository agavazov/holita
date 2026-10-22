import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { DevicesRepository } from '../src/modules/devices/devices.repository.js';
import { DriversRepository } from '../src/modules/drivers/drivers.repository.js';
import { VehicleGroupsRepository } from '../src/modules/vehicle-groups/vehicle-groups.repository.js';
import { VehiclesRepository } from '../src/modules/vehicles/vehicles.repository.js';
import { uniqueViolation } from '../src/validation.js';
import { createTestDatabase } from './test-database.js';
import { getTestDatabaseUrl } from './test-database-url.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
// 06:00 UTC is the business date 18 October 2026 in Europe/Sofia.
const now = new Date('2026-10-18T06:00:00.000Z');
const createVehicle =
  'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id}}';
const updateVehicle =
  'mutation($id:ID!,$input:UpdateFleetVehicleInput!){updateFleetVehicle(id:$id,input:$input){id}}';
const createDevice =
  'mutation($input:CreateFleetDeviceInput!){createFleetDevice(input:$input){id}}';
const updateDevice =
  'mutation($id:ID!,$input:UpdateFleetDeviceInput!){updateFleetDevice(id:$id,input:$input){id}}';
const createDriver =
  'mutation($input:CreateFleetDriverInput!){createFleetDriver(input:$input){id}}';
const updateDriver =
  'mutation($id:ID!,$input:UpdateFleetDriverInput!){updateFleetDriver(id:$id,input:$input){id}}';
const createGroup =
  'mutation($input:CreateFleetVehicleGroupInput!){createFleetVehicleGroup(input:$input){id}}';
const updateGroup =
  'mutation($id:ID!,$input:UpdateFleetVehicleGroupInput!){updateFleetVehicleGroup(id:$id,input:$input){id}}';

interface Scope {
  tenantId?: string;
  branchId?: string;
}

async function rejection(action: Promise<unknown>): Promise<unknown> {
  try {
    await action;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the database to reject the write');
}

describe('Fleet scope isolation and referential integrity in PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const connection = new pg.Client({ connectionString: getTestDatabaseUrl() });
  let connected = false;
  const requireBranch = jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined);
  const branchId = randomUUID(),
    otherBranchId = randomUUID();
  let vehicleId: string;
  let module: TestingModule;
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    await connection.connect();
    connected = true;
    await connection.query(`SET search_path TO ${pg.escapeIdentifier(database.schema)}`);
    module = await Test.createTestingModule({ imports: [AppModule] })
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
    vehicleId = (
      await database.client.vehicle.create({ data: { tenantId, branchId, licensePlate: 'BASE' } })
    ).id;
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
  async function query(
    source: string,
    variables: Record<string, unknown>,
    scope: Scope = { tenantId, branchId },
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(scope.tenantId ? { authorization: `Bearer ${issueDemoToken(scope.tenantId)}` } : {}),
        ...(scope.branchId ? { 'x-branch-id': scope.branchId } : {}),
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  async function sqlError(statement: string, values: unknown[]) {
    return rejection(connection.query(statement, values));
  }

  it('records of another Tenant or Branch stay invisible to by-ID reads, writes, batch actions and federation references', async () => {
    const client = database.client;
    const owner = { tenantId, branchId: randomUUID() };
    const group = await client.vehicleGroup.create({ data: { ...owner, name: 'Owner group' } });
    const driver = await client.driver.create({
      data: { ...owner, firstName: 'Owner', lastName: 'Driver' },
    });
    const vehicle = await client.vehicle.create({ data: { ...owner, licensePlate: 'OWNER' } });
    const device = await client.device.create({
      data: { ...owner, vehicleId: vehicle.id, imei: '990601000000101' },
    });
    const trip = await client.trip.create({
      data: {
        ...owner,
        vehicleId: vehicle.id,
        driverId: driver.id,
        source: 'DEMO',
        startedAt: now,
      },
    });
    const alert = await client.fleetEvent.create({
      data: {
        ...owner,
        vehicleId: vehicle.id,
        source: 'DEMO',
        occurredAt: now,
        kind: 'LOW_FUEL',
        severity: 'WARNING',
        alertStatus: 'OPEN',
      },
    });
    const task = await client.serviceTask.create({
      data: {
        ...owner,
        vehicleId: vehicle.id,
        serviceType: 'OIL_CHANGE',
        dueOn: new Date('2026-11-01T00:00:00.000Z'),
      },
    });
    const ownerRows = () =>
      Promise.all([
        client.vehicleGroup.findMany({ where: owner, orderBy: { id: 'asc' } }),
        client.driver.findMany({ where: owner, orderBy: { id: 'asc' } }),
        client.vehicle.findMany({ where: owner, orderBy: { id: 'asc' } }),
        client.device.findMany({ where: owner, orderBy: { id: 'asc' } }),
        client.trip.findMany({ where: owner, orderBy: { id: 'asc' } }),
        client.fleetEvent.findMany({ where: owner, orderBy: { id: 'asc' } }),
        client.serviceTask.findMany({ where: owner, orderBy: { id: 'asc' } }),
      ]);
    const before = await ownerRows();

    // A missing token or an invalid Branch fails before Core or any write is reached.
    const unscoped: [string, Scope, string][] = [
      ['missing token', { branchId: owner.branchId }, 'UNAUTHENTICATED'],
      ['missing Branch', { tenantId }, 'BAD_USER_INPUT'],
      ['invalid Branch', { tenantId, branchId: 'not-a-uuid' }, 'BAD_USER_INPUT'],
    ];
    for (const [row, scope, code] of unscoped) {
      expect({
        row,
        value: await query(createVehicle, { input: { licensePlate: 'UNSCOPED' } }, scope),
      }).toMatchObject({ row, value: { data: null, errors: [{ extensions: { code } }] } });
    }
    expect(requireBranch).not.toHaveBeenCalled();
    expect(await client.vehicle.count({ where: { licensePlate: 'UNSCOPED' } })).toBe(0);

    // Federation references resolve from the scoped database, never from the representation.
    expect(
      await query(
        'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetVehicle{id branchId licensePlate}...on FleetDevice{id imei}}}',
        {
          refs: [
            {
              __typename: 'FleetVehicle',
              id: vehicle.id,
              branchId: randomUUID(),
              licensePlate: 'SPOOFED',
            },
            { __typename: 'FleetDevice', id: device.id, imei: 'spoofed', vehicleId: randomUUID() },
          ],
        },
        owner,
      ),
    ).toEqual({
      data: {
        _entities: [
          { id: vehicle.id, branchId: owner.branchId, licensePlate: 'OWNER' },
          { id: device.id, imei: device.imei },
        ],
      },
    });

    const missing = { errors: [{ extensions: { code: 'NOT_FOUND' } }] };
    const failed = (field: string, id: string) => ({
      data: { [field]: { succeededIds: [], failures: [{ id, code: 'NOT_FOUND' }] } },
    });
    const operations: [string, string, Record<string, unknown>, unknown][] = [
      ['vehicle read', 'query($id:ID!){fleetVehicle(id:$id){id}}', { id: vehicle.id }, missing],
      [
        'vehicle update',
        'mutation($id:ID!){updateFleetVehicle(id:$id,input:{licensePlate:"SPOOFED"}){id}}',
        { id: vehicle.id },
        missing,
      ],
      [
        'vehicle deactivation',
        'mutation($id:ID!){deactivateFleetVehicle(id:$id){id}}',
        { id: vehicle.id },
        missing,
      ],
      [
        'vehicle deletion',
        'mutation($id:ID!){deleteFleetVehicle(id:$id){id}}',
        { id: vehicle.id },
        missing,
      ],
      [
        'vehicle batch deletion',
        'mutation($ids:[ID!]!){deleteFleetVehicles(ids:$ids){succeededIds failures{id code}}}',
        { ids: [vehicle.id] },
        failed('deleteFleetVehicles', vehicle.id),
      ],
      [
        'vehicle batch deactivation',
        'mutation($ids:[ID!]!){deactivateFleetVehicles(ids:$ids){succeededIds failures{id code}}}',
        { ids: [vehicle.id] },
        failed('deactivateFleetVehicles', vehicle.id),
      ],
      [
        'vehicle federation reference',
        'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetVehicle{id}}}',
        { refs: [{ __typename: 'FleetVehicle', id: vehicle.id }] },
        missing,
      ],
      [
        'vehicle samples',
        'query($id:ID!,$from:DateTime!,$to:DateTime!){fleetVehicleSamples(vehicleId:$id,from:$from,to:$to){vehicleId}}',
        { id: vehicle.id, from: '2026-10-17T00:00:00Z', to: '2026-10-18T00:00:00Z' },
        missing,
      ],
      [
        'vehicle daily distance',
        'query($id:ID!){fleetDailyDistance(vehicleId:$id,days:7){dataAsOf}}',
        { id: vehicle.id },
        missing,
      ],
      ['device read', 'query($id:ID!){fleetDevice(id:$id){id}}', { id: device.id }, missing],
      [
        'device update',
        'mutation($id:ID!){updateFleetDevice(id:$id,input:{imei:"990601000000102"}){id}}',
        { id: device.id },
        missing,
      ],
      [
        'device deletion',
        'mutation($id:ID!){deleteFleetDevice(id:$id){id}}',
        { id: device.id },
        missing,
      ],
      [
        'device batch deletion',
        'mutation($ids:[ID!]!){deleteFleetDevices(ids:$ids){succeededIds failures{id code}}}',
        { ids: [device.id] },
        failed('deleteFleetDevices', device.id),
      ],
      [
        'device federation reference',
        'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetDevice{id}}}',
        { refs: [{ __typename: 'FleetDevice', id: device.id }] },
        missing,
      ],
      ['driver read', 'query($id:ID!){fleetDriver(id:$id){id}}', { id: driver.id }, missing],
      [
        'driver scorecard',
        'query($id:ID!){fleetDriverScorecard(driverId:$id,days:30){tripCount}}',
        { id: driver.id },
        missing,
      ],
      [
        'driver update',
        'mutation($id:ID!){updateFleetDriver(id:$id,input:{notes:"Spoofed"}){id}}',
        { id: driver.id },
        missing,
      ],
      [
        'driver deletion',
        'mutation($id:ID!){deleteFleetDriver(id:$id){id}}',
        { id: driver.id },
        missing,
      ],
      [
        'driver batch deletion',
        'mutation($ids:[ID!]!){deleteFleetDrivers(ids:$ids){succeededIds failures{id code}}}',
        { ids: [driver.id] },
        failed('deleteFleetDrivers', driver.id),
      ],
      [
        'driver batch deactivation',
        'mutation($ids:[ID!]!){deactivateFleetDrivers(ids:$ids){succeededIds failures{id code}}}',
        { ids: [driver.id] },
        failed('deactivateFleetDrivers', driver.id),
      ],
      [
        'vehicle group read',
        'query($id:ID!){fleetVehicleGroup(id:$id){id}}',
        { id: group.id },
        missing,
      ],
      [
        'vehicle group list',
        'query($ids:[ID!]){fleetVehicleGroups(ids:$ids){items{id}total}}',
        { ids: [group.id] },
        { data: { fleetVehicleGroups: { items: [], total: 0 } } },
      ],
      [
        'vehicle group update',
        'mutation($id:ID!){updateFleetVehicleGroup(id:$id,input:{name:"Spoofed"}){id}}',
        { id: group.id },
        missing,
      ],
      [
        'vehicle group deletion',
        'mutation($id:ID!){deleteFleetVehicleGroup(id:$id){id}}',
        { id: group.id },
        missing,
      ],
      [
        'service task read',
        'query($id:ID!){fleetServiceTask(id:$id){id}}',
        { id: task.id },
        missing,
      ],
      [
        'service task update',
        'mutation($id:ID!){updateFleetServiceTask(id:$id,input:{title:"Spoofed"}){id}}',
        { id: task.id },
        missing,
      ],
      [
        'service task completion',
        'mutation($id:ID!){completeFleetServiceTask(id:$id,input:{completedOn:"2026-10-18"}){completed{id}}}',
        { id: task.id },
        missing,
      ],
      [
        'service task cancellation',
        'mutation($id:ID!){cancelFleetServiceTask(id:$id){id}}',
        { id: task.id },
        missing,
      ],
      [
        'service task deletion',
        'mutation($id:ID!){deleteFleetServiceTask(id:$id){id}}',
        { id: task.id },
        missing,
      ],
      [
        'service task batch cancellation',
        'mutation($ids:[ID!]!){cancelFleetServiceTasks(ids:$ids){succeededIds failures{id code}}}',
        { ids: [task.id] },
        failed('cancelFleetServiceTasks', task.id),
      ],
      [
        'service task batch deletion',
        'mutation($ids:[ID!]!){deleteFleetServiceTasks(ids:$ids){succeededIds failures{id code}}}',
        { ids: [task.id] },
        failed('deleteFleetServiceTasks', task.id),
      ],
      ['event read', 'query($id:ID!){fleetEvent(id:$id){id}}', { id: alert.id }, missing],
      [
        'alert acknowledgement',
        'mutation($id:ID!){acknowledgeFleetAlert(id:$id,input:{expectedStatus:OPEN}){id}}',
        { id: alert.id },
        missing,
      ],
      [
        'alert resolution',
        'mutation($id:ID!){resolveFleetAlert(id:$id,input:{expectedStatus:OPEN}){id}}',
        { id: alert.id },
        missing,
      ],
      [
        'alert reopening',
        'mutation($id:ID!){reopenFleetAlert(id:$id,input:{expectedStatus:RESOLVED}){id}}',
        { id: alert.id },
        missing,
      ],
      [
        'alert batch acknowledgement',
        'mutation($ids:[ID!]!){acknowledgeFleetAlerts(ids:$ids,input:{expectedStatus:OPEN}){succeededIds failures{id code}}}',
        { ids: [alert.id] },
        failed('acknowledgeFleetAlerts', alert.id),
      ],
      ['trip read', 'query($id:ID!){fleetTrip(id:$id){id}}', { id: trip.id }, missing],
    ];
    const foreignScopes: [string, Scope][] = [
      ['other Tenant, same Branch ID', { tenantId: randomUUID(), branchId: owner.branchId }],
      ['same Tenant, other Branch', { tenantId, branchId: randomUUID() }],
    ];
    for (const [scopeName, scope] of foreignScopes) {
      for (const [row, source, variables, expected] of operations) {
        expect({
          scope: scopeName,
          row,
          value: await query(source, variables, scope),
        }).toMatchObject({ scope: scopeName, row, value: expected });
      }
    }
    expect(await ownerRows()).toEqual(before);

    // A create in a Branch that Core does not confirm persists nothing.
    const unconfirmed = { tenantId, branchId: randomUUID() };
    const creates: [string, string, Record<string, unknown>][] = [
      ['vehicle', createVehicle, { input: { licensePlate: 'UNCONFIRMED' } }],
      ['device', createDevice, { input: { imei: '990601000000103' } }],
      ['driver', createDriver, { input: { firstName: 'Unconfirmed', lastName: 'Driver' } }],
      ['vehicle group', createGroup, { input: { name: 'Unconfirmed' } }],
    ];
    for (const [row, source, variables] of creates) {
      requireBranch.mockRejectedValueOnce(new NotFoundException('Branch not found'));
      expect({ row, value: await query(source, variables, unconfirmed) }).toMatchObject({
        row,
        value: { data: null, errors: [{ extensions: { code: 'NOT_FOUND' } }] },
      });
    }
    expect(
      await Promise.all([
        client.vehicle.count({ where: unconfirmed }),
        client.device.count({ where: unconfirmed }),
        client.driver.count({ where: unconfirmed }),
        client.vehicleGroup.count({ where: unconfirmed }),
      ]),
    ).toEqual([0, 0, 0, 0]);
  });

  it('cross-scope references are rejected by the API and by composite FKs', async () => {
    const client = database.client;
    const own = { tenantId, branchId };
    const device = await client.device.create({
      data: { ...own, vehicleId, imei: '990601000000201' },
    });
    const otherVehicle = await client.vehicle.create({ data: { ...own, licensePlate: 'OTHER' } });
    const trip = await client.trip.create({
      data: { ...own, vehicleId, source: 'DEMO', startedAt: now },
    });
    const otherTrip = await client.trip.create({
      data: { ...own, vehicleId: otherVehicle.id, source: 'DEMO', startedAt: now },
    });
    const event = await client.fleetEvent.create({
      data: {
        ...own,
        vehicleId,
        source: 'DEMO',
        occurredAt: now,
        kind: 'LOW_FUEL',
        severity: 'WARNING',
        alertStatus: 'OPEN',
      },
    });
    const ownRows = () =>
      Promise.all([
        client.vehicle.findMany({ where: own, orderBy: { id: 'asc' } }),
        client.device.findMany({ where: own, orderBy: { id: 'asc' } }),
        client.trip.findMany({ where: own, orderBy: { id: 'asc' } }),
        client.fleetEvent.findMany({ where: own, orderBy: { id: 'asc' } }),
        client.serviceTask.findMany({ where: own, orderBy: { id: 'asc' } }),
      ]);
    const before = await ownRows();
    const foreignScopes = [
      ['other Tenant, same Branch ID', { tenantId: randomUUID(), branchId }],
      ['same Tenant, other Branch', { tenantId, branchId: otherBranchId }],
    ] as const;
    for (const [scope, foreign] of foreignScopes) {
      const foreignGroup = await client.vehicleGroup.create({
        data: { ...foreign, name: 'Foreign' },
      });
      const foreignDriver = await client.driver.create({
        data: { ...foreign, firstName: 'Foreign', lastName: 'Driver' },
      });
      const foreignVehicle = await client.vehicle.create({
        data: { ...foreign, licensePlate: 'FOREIGN' },
      });
      const foreignTrip = await client.trip.create({
        data: { ...foreign, vehicleId: foreignVehicle.id, source: 'DEMO', startedAt: now },
      });
      const references: [string, string, Record<string, unknown>, string][] = [
        [
          'vehicle creation with a foreign group',
          createVehicle,
          { input: { licensePlate: 'REFERENCE', groupId: foreignGroup.id } },
          'groupId',
        ],
        [
          'vehicle creation with a foreign driver',
          createVehicle,
          { input: { licensePlate: 'REFERENCE', currentDriverId: foreignDriver.id } },
          'currentDriverId',
        ],
        [
          'vehicle update with a foreign group',
          updateVehicle,
          { id: vehicleId, input: { groupId: foreignGroup.id } },
          'groupId',
        ],
        [
          'vehicle update with a foreign driver',
          updateVehicle,
          { id: vehicleId, input: { currentDriverId: foreignDriver.id } },
          'currentDriverId',
        ],
        [
          'device creation with a foreign vehicle',
          createDevice,
          { input: { imei: '990601000000202', vehicleId: foreignVehicle.id } },
          'vehicleId',
        ],
        [
          'device update with a foreign vehicle',
          updateDevice,
          { id: device.id, input: { vehicleId: foreignVehicle.id } },
          'vehicleId',
        ],
        [
          'service task creation with a foreign vehicle',
          'mutation($input:CreateFleetServiceTaskInput!){createFleetServiceTask(input:$input){id}}',
          { input: { vehicleId: foreignVehicle.id, serviceType: 'BRAKES', dueOn: '2026-11-01' } },
          'vehicleId',
        ],
      ];
      for (const [row, source, variables, path] of references) {
        expect({ scope, row, value: await query(source, variables) }).toMatchObject({
          scope,
          row,
          value: {
            data: null,
            errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
          },
        });
      }
      const writes: [string, () => Promise<unknown>, Record<string, string>][] = [
        [
          'Device to Vehicle',
          () =>
            client.device.create({
              data: { ...own, vehicleId: foreignVehicle.id, imei: '990601000000203' },
            }),
          { code: 'P2003' },
        ],
        [
          'Vehicle to VehicleGroup',
          () =>
            connection.query('UPDATE "Vehicle" SET "groupId" = $2 WHERE id = $1', [
              vehicleId,
              foreignGroup.id,
            ]),
          { code: '23503', constraint: 'Vehicle_tenantId_branchId_groupId_fkey' },
        ],
        [
          'Vehicle to Driver',
          () =>
            connection.query('UPDATE "Vehicle" SET "currentDriverId" = $2 WHERE id = $1', [
              vehicleId,
              foreignDriver.id,
            ]),
          { code: '23503', constraint: 'Vehicle_tenantId_branchId_currentDriverId_fkey' },
        ],
        [
          'Trip to Driver',
          () =>
            connection.query('UPDATE "Trip" SET "driverId" = $2 WHERE id = $1', [
              trip.id,
              foreignDriver.id,
            ]),
          { code: '23503', constraint: 'Trip_tenantId_branchId_driverId_fkey' },
        ],
        [
          'FleetEvent to Trip',
          () =>
            connection.query('UPDATE "FleetEvent" SET "tripId" = $2 WHERE id = $1', [
              event.id,
              foreignTrip.id,
            ]),
          { code: '23503', constraint: 'FleetEvent_tenantId_branchId_vehicleId_tripId_fkey' },
        ],
        [
          'FleetEvent to Driver',
          () =>
            connection.query('UPDATE "FleetEvent" SET "driverId" = $2 WHERE id = $1', [
              event.id,
              foreignDriver.id,
            ]),
          { code: '23503', constraint: 'FleetEvent_tenantId_branchId_driverId_fkey' },
        ],
        [
          'VehicleStatusSample to Vehicle',
          () =>
            client.vehicleStatusSample.create({
              data: {
                ...foreign,
                vehicleId,
                source: 'MANUAL',
                recordedAt: now,
                receivedAt: now,
                odometerKm: 1,
              },
            }),
          { code: 'P2003' },
        ],
        [
          'ServiceTask to Vehicle',
          () =>
            client.serviceTask.create({
              data: { ...foreign, vehicleId, serviceType: 'TIRES', dueOdometerKm: 1 },
            }),
          { code: 'P2003' },
        ],
      ];
      for (const [row, write, error] of writes) {
        expect({ scope, row, value: await rejection(write()) }).toMatchObject({
          scope,
          row,
          value: error,
        });
      }
    }
    // The trip exists in the Branch but belongs to another vehicle.
    expect(
      await sqlError('UPDATE "FleetEvent" SET "tripId" = $2 WHERE id = $1', [
        event.id,
        otherTrip.id,
      ]),
    ).toMatchObject({
      code: '23503',
      constraint: 'FleetEvent_tenantId_branchId_vehicleId_tripId_fkey',
    });
    expect(await ownRows()).toEqual(before);
  });

  it('unique violations map to fieldErrors per Tenant/Branch', async () => {
    const client = database.client;
    const vin = 'WDB9634031L123456';
    await client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'U1', fleetNumber: 'U-01', vin },
    });
    await client.device.create({
      data: { tenantId, branchId, vehicleId, imei: '123456789012345' },
    });
    await client.driver.create({
      data: {
        tenantId,
        branchId,
        firstName: 'U',
        lastName: 'One',
        employeeNumber: 'E-01',
        identificationKey: 'K-01',
      },
    });
    await client.vehicleGroup.create({ data: { tenantId, branchId, name: 'Unique' } });
    const indexes: [string, Promise<unknown>][] = [
      [
        'Vehicle_tenantId_branchId_fleetNumber_key',
        client.vehicle.create({
          data: { tenantId, branchId, licensePlate: 'U2', fleetNumber: 'U-01' },
        }),
      ],
      [
        'Vehicle_tenantId_branchId_vin_key',
        client.vehicle.create({ data: { tenantId, branchId, licensePlate: 'U3', vin } }),
      ],
      [
        'Device_tenantId_branchId_imei_key',
        client.device.create({
          data: { tenantId, branchId, vehicleId, imei: '123456789012345' },
        }),
      ],
      [
        'Driver_tenantId_branchId_employeeNumber_key',
        client.driver.create({
          data: { tenantId, branchId, firstName: 'U', lastName: 'Two', employeeNumber: 'E-01' },
        }),
      ],
      [
        'Driver_tenantId_branchId_identificationKey_key',
        client.driver.create({
          data: {
            tenantId,
            branchId,
            firstName: 'U',
            lastName: 'Three',
            identificationKey: 'K-01',
          },
        }),
      ],
      [
        'VehicleGroup_tenantId_branchId_name_key',
        client.vehicleGroup.create({ data: { tenantId, branchId, name: 'Unique' } }),
      ],
    ];
    for (const [index, write] of indexes) {
      expect(uniqueViolation(await rejection(write))).toEqual({ index, fields: [] });
    }

    // The scoped pre-check reports the duplicate fields of creates and updates.
    const otherVehicle = await client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'U0' },
    });
    const otherDevice = await client.device.create({
      data: { tenantId, branchId, vehicleId, imei: '123456789012340' },
    });
    const otherDriver = await client.driver.create({
      data: { tenantId, branchId, firstName: 'U', lastName: 'Zero' },
    });
    const otherGroup = await client.vehicleGroup.create({
      data: { tenantId, branchId, name: 'Other' },
    });
    const checked: [string, string, Record<string, unknown>, string[]][] = [
      [
        'vehicle creation',
        createVehicle,
        { input: { licensePlate: 'U2', fleetNumber: 'U-01', vin: vin.toLowerCase() } },
        ['fleetNumber', 'vin'],
      ],
      [
        'vehicle update',
        updateVehicle,
        { id: otherVehicle.id, input: { fleetNumber: 'U-01' } },
        ['fleetNumber'],
      ],
      [
        'device creation',
        createDevice,
        { input: { imei: '123456789012345', vehicleId } },
        ['imei'],
      ],
      [
        'device update',
        updateDevice,
        { id: otherDevice.id, input: { imei: '123456789012345' } },
        ['imei'],
      ],
      [
        'driver creation',
        createDriver,
        {
          input: {
            firstName: 'U',
            lastName: 'Two',
            employeeNumber: 'E-01',
            identificationKey: 'K-01',
          },
        },
        ['employeeNumber', 'identificationKey'],
      ],
      [
        'driver update',
        updateDriver,
        { id: otherDriver.id, input: { identificationKey: 'K-01' } },
        ['identificationKey'],
      ],
      ['vehicle group creation', createGroup, { input: { name: ' Unique ' } }, ['name']],
      [
        'vehicle group update',
        updateGroup,
        { id: otherGroup.id, input: { name: 'Unique' } },
        ['name'],
      ],
    ];
    for (const [row, source, variables, paths] of checked) {
      expect({ row, value: await query(source, variables) }).toMatchObject({
        row,
        value: {
          data: null,
          errors: [
            {
              extensions: {
                code: 'BAD_USER_INPUT',
                fieldErrors: paths.map((path) => ({ path })),
              },
            },
          ],
        },
      });
    }

    // The same values are accepted in another Branch.
    const elsewhere = { tenantId, branchId: randomUUID() };
    const accepted: [string, string, Record<string, unknown>][] = [
      [
        'createFleetVehicle',
        createVehicle,
        { input: { licensePlate: 'U1', fleetNumber: 'U-01', vin } },
      ],
      ['createFleetDevice', createDevice, { input: { imei: '123456789012345' } }],
      [
        'createFleetDriver',
        createDriver,
        {
          input: {
            firstName: 'U',
            lastName: 'One',
            employeeNumber: 'E-01',
            identificationKey: 'K-01',
          },
        },
      ],
      ['createFleetVehicleGroup', createGroup, { input: { name: 'Unique' } }],
    ];
    for (const [field, source, variables] of accepted) {
      expect({ row: field, value: await query(source, variables, elsewhere) }).toEqual({
        row: field,
        value: { data: { [field]: { id: expect.any(String) } } },
      });
    }

    // Bypass each service's scoped pre-check so the real insert raises P2002 (a concurrent write).
    const spies = [
      jest
        .spyOn(module.get(VehiclesRepository), 'duplicates')
        .mockResolvedValue({ fleetNumber: false, vin: false }),
      jest.spyOn(module.get(DevicesRepository), 'imeiTaken').mockResolvedValue(false),
      jest
        .spyOn(module.get(DriversRepository), 'duplicates')
        .mockResolvedValue({ employeeNumber: false, identificationKey: false }),
      jest.spyOn(module.get(VehicleGroupsRepository), 'nameTaken').mockResolvedValue(false),
    ];
    try {
      const mapped: [string, string, Record<string, unknown>][] = [
        ['fleetNumber', createVehicle, { input: { licensePlate: 'U4', fleetNumber: 'U-01' } }],
        ['vin', createVehicle, { input: { licensePlate: 'U5', vin: vin.toLowerCase() } }],
        ['imei', createDevice, { input: { imei: '123456789012345', vehicleId } }],
        [
          'employeeNumber',
          createDriver,
          { input: { firstName: 'U', lastName: 'Four', employeeNumber: 'E-01' } },
        ],
        [
          'identificationKey',
          createDriver,
          { input: { firstName: 'U', lastName: 'Five', identificationKey: 'K-01' } },
        ],
        ['name', createGroup, { input: { name: ' Unique ' } }],
      ];
      for (const [path, source, variables] of mapped) {
        expect({ row: path, value: await query(source, variables) }).toMatchObject({
          row: path,
          value: {
            data: null,
            errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
          },
        });
      }
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
    }
  });

  it('deleting referenced records is refused with CONFLICT and history survives', async () => {
    const client = database.client;
    const scope = { tenantId, branchId: randomUUID() };
    const group = await client.vehicleGroup.create({ data: { ...scope, name: 'Filled' } });
    const assignedDriver = await client.driver.create({
      data: { ...scope, firstName: 'Assigned', lastName: 'Driver' },
    });
    const tripDriver = await client.driver.create({
      data: { ...scope, firstName: 'Trip', lastName: 'Driver' },
    });
    const member = await client.vehicle.create({
      data: {
        ...scope,
        licensePlate: 'MEMBER',
        groupId: group.id,
        currentDriverId: assignedDriver.id,
      },
    });
    const equipped = await client.vehicle.create({ data: { ...scope, licensePlate: 'EQUIPPED' } });
    const historic = await client.vehicle.create({ data: { ...scope, licensePlate: 'HISTORIC' } });
    const stock = await client.device.create({
      data: { ...scope, vehicleId: equipped.id, imei: '990601000000401' },
    });
    const reporting = await client.device.create({
      data: { ...scope, vehicleId: historic.id, imei: '990601000000402' },
    });
    await client.vehicleStatusSample.create({
      data: {
        ...scope,
        vehicleId: historic.id,
        deviceImei: reporting.imei,
        source: 'DEMO',
        recordedAt: now,
        receivedAt: now,
      },
    });
    await client.trip.create({
      data: {
        ...scope,
        vehicleId: historic.id,
        driverId: tripDriver.id,
        source: 'DEMO',
        startedAt: now,
      },
    });
    const done = await client.serviceTask.create({
      data: {
        ...scope,
        vehicleId: historic.id,
        serviceType: 'OIL_CHANGE',
        status: 'DONE',
        completedOn: new Date('2026-10-10T00:00:00.000Z'),
      },
    });
    const planned = await client.serviceTask.create({
      data: {
        ...scope,
        vehicleId: historic.id,
        serviceType: 'BRAKES',
        dueOn: new Date('2026-11-01T00:00:00.000Z'),
      },
    });
    const cancelled = await client.serviceTask.create({
      data: {
        ...scope,
        vehicleId: historic.id,
        serviceType: 'TIRES',
        dueOn: new Date('2026-11-01T00:00:00.000Z'),
      },
    });
    const deletion = (field: string) => `mutation($id:ID!){${field}(id:$id){id}}`;
    // Deleting a device keeps its samples, which remain the vehicle's history.
    expect(await query(deletion('deleteFleetDevice'), { id: reporting.id }, scope)).toEqual({
      data: { deleteFleetDevice: { id: reporting.id } },
    });
    const vehicleConflict = 'Vehicle has devices or history; deactivate it instead.';
    const driverConflict =
      'Driver is assigned or has trip history; set the driver inactive instead.';
    const refused: [string, string, string, string][] = [
      ['vehicle with a device', 'deleteFleetVehicle', equipped.id, vehicleConflict],
      ['vehicle with history', 'deleteFleetVehicle', historic.id, vehicleConflict],
      ['assigned driver', 'deleteFleetDriver', assignedDriver.id, driverConflict],
      ['driver with trips', 'deleteFleetDriver', tripDriver.id, driverConflict],
      [
        'non-empty vehicle group',
        'deleteFleetVehicleGroup',
        group.id,
        'Vehicle group still contains vehicles; move them first.',
      ],
      [
        'completed service task',
        'deleteFleetServiceTask',
        done.id,
        'Completed service is kept as history',
      ],
    ];
    for (const [row, field, id, message] of refused) {
      expect({ row, value: await query(deletion(field), { id }, scope) }).toMatchObject({
        row,
        value: { data: null, errors: [{ message, extensions: { code: 'CONFLICT' } }] },
      });
    }
    // Remove each removable reference.
    expect(
      await query(
        'mutation($id:ID!){updateFleetDevice(id:$id,input:{vehicleId:null}){vehicleId}}',
        { id: stock.id },
        scope,
      ),
    ).toEqual({ data: { updateFleetDevice: { vehicleId: null } } });
    await client.vehicle.update({
      where: { id: member.id },
      data: { groupId: null, currentDriverId: null },
    });
    expect(
      await query(
        'mutation($id:ID!){cancelFleetServiceTask(id:$id){status}}',
        { id: cancelled.id },
        scope,
      ),
    ).toEqual({ data: { cancelFleetServiceTask: { status: 'CANCELLED' } } });
    const allowed: [string, string, string][] = [
      ['released vehicle', 'deleteFleetVehicle', equipped.id],
      ['unassigned driver', 'deleteFleetDriver', assignedDriver.id],
      ['emptied vehicle group', 'deleteFleetVehicleGroup', group.id],
      ['planned service task', 'deleteFleetServiceTask', planned.id],
      ['cancelled service task', 'deleteFleetServiceTask', cancelled.id],
    ];
    for (const [row, field, id] of allowed) {
      expect({ row, value: await query(deletion(field), { id }, scope) }).toEqual({
        row,
        value: { data: { [field]: { id } } },
      });
    }
    expect(
      await Promise.all([
        client.vehicle.count({ where: { ...scope, id: historic.id } }),
        client.driver.count({ where: { ...scope, id: tripDriver.id } }),
        client.serviceTask.count({ where: { ...scope, id: done.id } }),
        client.trip.count({ where: scope }),
        client.vehicleStatusSample.count({ where: { ...scope, deviceImei: reporting.imei } }),
      ]),
    ).toEqual([1, 1, 1, 1, 1]);
  });
});
