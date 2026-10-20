import {
  AdminCreateVehicleGroupDocument,
  AdminDeleteVehicleGroupDocument,
  AdminUpdateVehicleGroupDocument,
  AdminVehicleGroupDocument,
  AdminVehicleGroupsListDocument,
  type AdminVehicleGroupDetailsFragment,
} from '../generated/graphql/operations';
import {
  fixtureError,
  graphqlFixture,
  type FixtureVariables,
  type WithTypename,
} from './graphql-fixtures';
import { defaultBranchId } from './session-fixtures';

export const fixtureVehicleGroups: readonly WithTypename<AdminVehicleGroupDetailsFragment>[] = [
  {
    __typename: 'FleetVehicleGroup',
    id: '30000000-0000-4000-8000-000000000001',
    branchId: defaultBranchId,
    name: 'International',
    description: 'Long-distance routes.',
    colorToken: 'C2',
    vehicleCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    __typename: 'FleetVehicleGroup',
    id: '30000000-0000-4000-8000-000000000002',
    branchId: defaultBranchId,
    name: 'Regional',
    description: null,
    colorToken: 'C3',
    vehicleCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function findGroup(variables: FixtureVariables): WithTypename<AdminVehicleGroupDetailsFragment> {
  const group = fixtureVehicleGroups.find(
    (candidate) => candidate.id === variables.requiredString('id'),
  );
  if (!group) {
    throw fixtureError('NOT_FOUND', 'The vehicle group was not found.');
  }
  return group;
}

// Immutable read snapshots exercise transport and page states. Refetch returns these same
// records after writes; real backend/browser checks cover persistence and protected deletion.
graphqlFixture(AdminVehicleGroupsListDocument, (variables) => {
  const offset = variables.int('offset', 0);
  const limit = variables.int('limit', 100);
  return {
    fleetVehicleGroups: {
      __typename: 'FleetVehicleGroupPage',
      items: fixtureVehicleGroups.slice(offset, offset + limit),
      total: fixtureVehicleGroups.length,
      offset,
      limit,
      ungroupedVehicleCount: 1,
    },
  };
});
graphqlFixture(AdminVehicleGroupDocument, (variables) => ({
  fleetVehicleGroup: findGroup(variables),
}));

function savedGroup(variables: FixtureVariables): WithTypename<AdminVehicleGroupDetailsFragment> {
  const base = variables.has('id') ? findGroup(variables) : fixtureVehicleGroups[1];
  if (!base) {
    throw fixtureError('NOT_FOUND', 'The vehicle group was not found.');
  }
  const input = variables.object('input');
  const colors = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'] as const;
  const colorToken =
    colors.find((color) => color === input.string('colorToken')) ?? base.colorToken;
  return {
    ...base,
    name: input.string('name') ?? base.name,
    description: input.has('description') ? input.string('description') : base.description,
    colorToken,
  };
}
graphqlFixture(AdminCreateVehicleGroupDocument, (variables) => ({
  createFleetVehicleGroup: savedGroup(variables),
}));
graphqlFixture(AdminUpdateVehicleGroupDocument, (variables) => ({
  updateFleetVehicleGroup: savedGroup(variables),
}));
graphqlFixture(AdminDeleteVehicleGroupDocument, (variables) => {
  const group = findGroup(variables);
  if (group.vehicleCount > 0) {
    throw fixtureError('CONFLICT', 'Vehicle group still contains vehicles; move them first.');
  }
  return { deleteFleetVehicleGroup: group };
});
