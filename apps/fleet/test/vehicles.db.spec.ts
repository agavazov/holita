import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const create =
  'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id branchId licensePlate notes}}';
const read = 'query($id:ID!){fleetVehicle(id:$id){id branchId licensePlate notes}}';
const update =
  'mutation($id:ID!,$input:UpdateFleetVehicleInput!){updateFleetVehicle(id:$id,input:$input){id licensePlate notes}}';
const remove = 'mutation($id:ID!){deleteFleetVehicle(id:$id){id}}';
describe('Vehicle GraphQL with PostgreSQL', () => {
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
  async function query(source: string, variables: Record<string, unknown>, branchId?: string) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(tenantId)}`,
        ...(branchId ? { 'x-branch-id': branchId } : {}),
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    const body: unknown = await response.json();
    return body;
  }
  it('persists two fields, preserves multiline notes, clears notes and deletes without a core read check', async () => {
    const branchId = randomUUID();
    expect(
      await query(
        create,
        { input: { licensePlate: ' CA1234AB ', notes: ' First\nSecond ' } },
        branchId,
      ),
    ).toMatchObject({
      data: {
        createFleetVehicle: { branchId, licensePlate: 'CA1234AB', notes: 'First\nSecond' },
      },
    });
    expect(requireBranch).toHaveBeenCalledTimes(1);
    const row = await database.client.vehicle.findFirstOrThrow({ where: { branchId } });
    requireBranch.mockClear();
    expect(await query(update, { id: row.id, input: { notes: null } }, branchId)).toMatchObject({
      data: { updateFleetVehicle: { licensePlate: 'CA1234AB', notes: null } },
    });
    expect(await query(remove, { id: row.id }, branchId)).toEqual({
      data: { deleteFleetVehicle: { id: row.id } },
    });
    expect(
      await database.client.vehicle.findUnique({ where: { id: row.id, branchId } }),
    ).toBeNull();
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it('hides foreign IDs in CRUD and resolves federation references from the scoped database', async () => {
    const branchId = randomUUID(),
      foreign = randomUUID();
    const row = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'OWNER' },
    });
    for (const source of [read, update, remove])
      expect(
        await query(source, { id: row.id, input: { licensePlate: 'Wrong' } }, foreign),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    const entity =
      'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetVehicle{id branchId licensePlate}}}';
    const variables = {
      refs: [
        { __typename: 'FleetVehicle', id: row.id, branchId: foreign, licensePlate: 'Spoofed' },
      ],
    };
    expect(await query(entity, variables, branchId)).toEqual({
      data: { _entities: [{ id: row.id, branchId, licensePlate: 'OWNER' }] },
    });
    expect(await query(entity, variables, foreign)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(await database.client.vehicle.findUnique({ where: { id: row.id, branchId } })).toEqual(
      row,
    );
  });
  it('requires scope and rejects invalid inputs without persistence', async () => {
    const branchId = randomUUID();
    expect(await query(create, { input: { licensePlate: 'CA1234AB' } })).toHaveProperty('errors');
    for (const input of [
      { licensePlate: ' ' },
      { licensePlate: 'A'.repeat(33) },
      { licensePlate: 'A\u0000' },
      { licensePlate: 'CA1234AB', notes: 'A'.repeat(2001) },
      { licensePlate: 'CA1234AB', branchId },
    ])
      expect(await query(create, { input }, branchId)).toHaveProperty('errors');
    expect(await database.client.vehicle.count({ where: { branchId } })).toBe(0);
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it('scopes totals, applies stable pagination and treats search punctuation literally', async () => {
    const branchId = randomUUID();
    await database.client.vehicle.createMany({
      data: [
        { tenantId, branchId, licensePlate: 'CA100%_AB' },
        { tenantId, branchId, licensePlate: 'CA2000AB' },
        { tenantId, branchId, licensePlate: 'CA3000AB' },
        { tenantId, branchId: randomUUID(), licensePlate: 'CAFOREIGN' },
      ],
    });
    const source =
      'query($search:String,$offset:Int!,$limit:Int!){fleetVehicles(search:$search,offset:$offset,limit:$limit,sort:{field:LICENSE_PLATE,direction:ASC}){items{licensePlate}total}}';
    expect(await query(source, { search: 'ca', offset: 1, limit: 1 }, branchId)).toEqual({
      data: { fleetVehicles: { items: [{ licensePlate: 'CA2000AB' }], total: 3 } },
    });
    expect(await query(source, { search: '%_', offset: 0, limit: 20 }, branchId)).toEqual({
      data: { fleetVehicles: { items: [{ licensePlate: 'CA100%_AB' }], total: 1 } },
    });
    expect(requireBranch).not.toHaveBeenCalled();
  });
});
