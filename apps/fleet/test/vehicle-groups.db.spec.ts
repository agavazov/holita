import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const fields = 'id branchId name description colorToken vehicleCount';
const create = `mutation($input:CreateFleetVehicleGroupInput!){createFleetVehicleGroup(input:$input){${fields}}}`;
const read = `query($id:ID!){fleetVehicleGroup(id:$id){${fields}}}`;
const update = `mutation($id:ID!,$input:UpdateFleetVehicleGroupInput!){updateFleetVehicleGroup(id:$id,input:$input){${fields}}}`;
const remove = 'mutation($id:ID!){deleteFleetVehicleGroup(id:$id){id}}';

describe('Vehicle group GraphQL with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const requireBranch = jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined);
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({ requireBranch })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
  });
  beforeEach(() => {
    requireBranch.mockClear();
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await closeDatabase?.();
    }
  });
  async function query(
    source: string,
    variables: Record<string, unknown>,
    branchId: string,
    scopeTenantId = tenantId,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(scopeTenantId)}`,
        'x-branch-id': branchId,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    const body: unknown = await response.json();
    return body;
  }

  it('creates with the default colour, updates, protects non-empty groups and deletes', async () => {
    const branchId = randomUUID();
    expect(
      await query(create, { input: { name: ' Long haul ', description: ' ' } }, branchId),
    ).toMatchObject({
      data: {
        createFleetVehicleGroup: {
          branchId,
          name: 'Long haul',
          description: null,
          colorToken: 'C1',
          vehicleCount: 0,
        },
      },
    });
    expect(requireBranch).toHaveBeenCalledTimes(1);
    requireBranch.mockClear();
    const group = await database.client.vehicleGroup.findFirstOrThrow({ where: { branchId } });
    expect(
      await query(
        update,
        { id: group.id, input: { colorToken: 'C7', description: 'Sofia – Varna' } },
        branchId,
      ),
    ).toMatchObject({
      data: { updateFleetVehicleGroup: { colorToken: 'C7', description: 'Sofia – Varna' } },
    });
    const vehicle = await database.client.vehicle.create({
      data: {
        tenantId,
        branchId,
        licensePlate: 'CB 1001 AX',
        groupId: group.id,
        status: 'INACTIVE',
      },
    });
    expect(await query(read, { id: group.id }, branchId)).toMatchObject({
      data: { fleetVehicleGroup: { vehicleCount: 1 } },
    });
    expect(await query(remove, { id: group.id }, branchId)).toMatchObject({
      errors: [
        {
          message: 'Vehicle group still contains vehicles; move them first.',
          extensions: { code: 'CONFLICT' },
        },
      ],
    });
    for (const source of [read, update, remove])
      expect(
        await query(source, { id: group.id, input: { name: 'Spoofed' } }, randomUUID()),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(await query(read, { id: group.id }, branchId, randomUUID())).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    await database.client.vehicle.update({ where: { id: vehicle.id }, data: { groupId: null } });
    expect(await query(remove, { id: group.id }, branchId)).toEqual({
      data: { deleteFleetVehicleGroup: { id: group.id } },
    });
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('keeps names unique per Branch after trimming', async () => {
    const branchId = randomUUID();
    await database.client.vehicleGroup.create({ data: { tenantId, branchId, name: 'Long haul' } });
    const other = await database.client.vehicleGroup.create({
      data: { tenantId, branchId, name: 'City' },
    });
    expect(await query(create, { input: { name: ' Long haul ' } }, branchId)).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'name' }] } }],
    });
    expect(
      await query(update, { id: other.id, input: { name: 'Long haul' } }, branchId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'name' }] } }] });
    expect(
      await query(update, { id: other.id, input: { name: 'City', colorToken: 'C2' } }, branchId),
    ).toMatchObject({ data: { updateFleetVehicleGroup: { name: 'City', colorToken: 'C2' } } });
    expect(await query(create, { input: { name: 'Long haul' } }, randomUUID())).toMatchObject({
      data: { createFleetVehicleGroup: { name: 'Long haul' } },
    });
    expect(
      await query(update, { id: other.id, input: { colorToken: null } }, branchId),
    ).toMatchObject({ errors: [{ extensions: { code: 'BAD_USER_INPUT' } }] });
  });

  it('lists by name with vehicle counts and the ungrouped count of the Branch only', async () => {
    const branchId = randomUUID(),
      otherTenant = randomUUID();
    const city = await database.client.vehicleGroup.create({
      data: { tenantId, branchId, name: 'City', description: 'Short routes' },
    });
    const haul = await database.client.vehicleGroup.create({
      data: { tenantId, branchId, name: 'Long haul', description: 'Sofia – Varna' },
    });
    await database.client.vehicleGroup.create({
      data: { tenantId, branchId, name: 'Агро', colorToken: 'C4' },
    });
    for (const [licensePlate, groupId, status] of [
      ['A1', city.id, 'ACTIVE'],
      ['A2', city.id, 'INACTIVE'],
      ['A3', haul.id, 'IN_WORKSHOP'],
      ['A4', null, 'ACTIVE'],
      ['A5', null, 'INACTIVE'],
    ] as const)
      await database.client.vehicle.create({
        data: { tenantId, branchId, licensePlate, groupId, status },
      });
    await database.client.vehicle.create({
      data: { tenantId, branchId: randomUUID(), licensePlate: 'OTHER BRANCH' },
    });
    await database.client.vehicle.create({
      data: { tenantId: otherTenant, branchId, licensePlate: 'OTHER TENANT' },
    });
    await database.client.vehicleGroup.create({
      data: { tenantId: otherTenant, branchId, name: 'City' },
    });
    const source =
      'query($search:String,$sort:FleetVehicleGroupSort,$offset:Int!,$limit:Int!){fleetVehicleGroups(search:$search,sort:$sort,offset:$offset,limit:$limit){items{name vehicleCount}total offset limit ungroupedVehicleCount}}';
    expect(await query(source, { offset: 0, limit: 20 }, branchId)).toEqual({
      data: {
        fleetVehicleGroups: {
          items: [
            { name: 'City', vehicleCount: 2 },
            { name: 'Long haul', vehicleCount: 1 },
            { name: 'Агро', vehicleCount: 0 },
          ],
          total: 3,
          offset: 0,
          limit: 20,
          ungroupedVehicleCount: 2,
        },
      },
    });
    expect(
      await query(
        source,
        { offset: 1, limit: 1, sort: { field: 'NAME', direction: 'DESC' } },
        branchId,
      ),
    ).toEqual({
      data: {
        fleetVehicleGroups: {
          items: [{ name: 'Long haul', vehicleCount: 1 }],
          total: 3,
          offset: 1,
          limit: 1,
          ungroupedVehicleCount: 2,
        },
      },
    });
    expect(
      await query(source, { offset: 0, limit: 20, search: 'sofia VARNA' }, branchId),
    ).toMatchObject({
      data: {
        fleetVehicleGroups: {
          items: [{ name: 'Long haul' }],
          total: 1,
          ungroupedVehicleCount: 2,
        },
      },
    });
    expect(await query(source, { offset: 0, limit: 20, search: 'агро' }, branchId)).toMatchObject({
      data: { fleetVehicleGroups: { items: [{ name: 'Агро' }], total: 1 } },
    });
    expect(await query(source, { offset: 0, limit: 20 }, randomUUID())).toEqual({
      data: {
        fleetVehicleGroups: { items: [], total: 0, offset: 0, limit: 20, ungroupedVehicleCount: 0 },
      },
    });
  });
});
