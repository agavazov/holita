import { describe, expect, it } from '@jest/globals';
import { parse, print } from 'graphql';
import {
  composeContracts,
  readContracts,
  readOperations,
  validateOperation,
} from './contracts.mjs';

describe('local GraphQL contracts', () => {
  it('composes real subgraphs and validates every named application operation offline', async () => {
    const result = composeContracts(await readContracts());
    expect(result.clientSdl).toContain('branch: Branch!');
    expect(result.clientSdl).not.toContain('_entities');
    const operations = await readOperations(result.apiSchema);
    expect(operations).toHaveLength(10);
    expect(operations.map((operation) => operation.location)).toEqual(
      expect.arrayContaining([
        'apps/admin/src/app/features/karma-client/cars/operations.graphql',
        'apps/admin/src/app/features/karma-client/edata/operations.graphql',
        'apps/admin/src/app/features/karma-client/location/operations.graphql',
        'apps/admin/src/app/features/karma-client/history/operations.graphql',
        'apps/admin/src/app/features/karma-client/references/operations.graphql',
        'apps/admin/src/app/features/karma-client/accounts/operations.graphql',
        'apps/admin/src/app/features/branches/operations.graphql',
        'apps/admin/src/app/features/fleet/vehicles/operations.graphql',
        'apps/admin/src/app/features/fleet/devices/operations.graphql',
        'apps/fleet/src/integrations/core/operations.graphql',
      ]),
    );
    expect(result.clientSdl).toContain('fleetVehicles(');
    expect(result.clientSdl).toContain('fleetDevices(');
    expect(result.apiSchema.getType('FleetVehicle')).toBeDefined();
    expect(result.apiSchema.getType('FleetDevice')).toBeDefined();
    expect(result.apiSchema.getType('ReferenceVehicle')).toBeUndefined();
    expect(result.apiSchema.getType('ReferenceDevice')).toBeUndefined();
    // Standard Fleet list contract: one shared sort direction and stored reference types.
    for (const name of [
      'FleetSortDirection',
      'FleetVehicleRef',
      'FleetDriverRef',
      'FleetVehicleGroupRef',
      'Date',
      'DateTime',
    ])
      expect(result.apiSchema.getType(name)).toBeDefined();
    for (const name of ['FleetVehicleSortDirection', 'FleetDeviceSortDirection'])
      expect(result.apiSchema.getType(name)).toBeUndefined();
    expect(Object.keys(result.apiSchema.getQueryType()?.getFields() ?? {}).sort()).toEqual([
      'branch',
      'branches',
      'fleetDevice',
      'fleetDevices',
      'fleetDriver',
      'fleetDrivers',
      'fleetVehicle',
      'fleetVehicleGroup',
      'fleetVehicleGroups',
      'fleetVehicles',
      'karmaCar',
      'karmaCars',
      'karmaDrivingProfile',
      'karmaEdata',
      'karmaEvents',
      'karmaLocation',
      'karmaProjects',
      'karmaRoles',
      'karmaTimeZones',
      'karmaTrips',
      'karmaUsers',
      'karmaVersion',
      'tenants',
    ]);
    expect(Object.keys(result.apiSchema.getMutationType()?.getFields() ?? {}).sort()).toEqual([
      'createFleetDevice',
      'createFleetDriver',
      'createFleetVehicle',
      'createFleetVehicleGroup',
      'deactivateFleetVehicle',
      'deleteFleetDevice',
      'deleteFleetDriver',
      'deleteFleetVehicle',
      'deleteFleetVehicleGroup',
      'demoLogin',
      'updateFleetDevice',
      'updateFleetDriver',
      'updateFleetVehicle',
      'updateFleetVehicleGroup',
    ]);
    const fleetVehicles = result.apiSchema.getQueryType()?.getFields()['fleetVehicles'];
    expect(fleetVehicles?.args.map((argument) => argument.name)).toEqual([
      'offset',
      'limit',
      'search',
      'ids',
      'filter',
      'sort',
    ]);
    expect(composeContracts(await readContracts()).supergraphSdl).toBe(result.supergraphSdl);
  });
  it('rejects an operation that no longer matches the API', async () => {
    const { apiSchema } = composeContracts(await readContracts());
    expect(() =>
      validateOperation(
        apiSchema,
        'query Invalid { branches { removedField } }',
        'invalid.graphql',
      ),
    ).toThrow('removedField');
  });
  it('fails composition when subgraphs disagree about the Branch key type', async () => {
    const contracts = await readContracts();
    const incompatible = contracts.map((contract) =>
      contract.name === 'core'
        ? { ...contract, typeDefs: parse(print(contract.typeDefs).replace('id: ID!', 'id: Int!')) }
        : contract,
    );
    expect(() => composeContracts(incompatible)).toThrow('Composition failed');
  });
});
