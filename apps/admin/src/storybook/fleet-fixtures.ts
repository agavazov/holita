import {
  AdminCreateVehicleDocument,
  AdminDeleteVehicleDocument,
  AdminUpdateVehicleDocument,
  AdminVehicleDocument,
  AdminVehiclesDocument,
  type AdminVehicleFragment,
} from '../generated/graphql/operations';
import { FixtureGraphqlError, type FixtureVariables, graphqlFixture } from './graphql-fixtures';
import { fixtureBranches } from './session-fixtures';

// Deterministic synthetic fleet. Every story starts from the same rows; changes made while
// clicking through one story persist until the next story resets the store.

type FixtureVehicle = AdminVehicleFragment & { readonly __typename: 'FleetVehicle' };

const regions = ['CA', 'CB', 'PB', 'B', 'A', 'BT', 'PA', 'CO', 'EH', 'KH'];
const series = ['AB', 'BX', 'KM', 'HT', 'PA', 'CE', 'MX', 'TK', 'OB'];
const notes: readonly (string | null)[] = [
  null,
  'Хладилна надстройка, обслужва маршрута София – Варна.',
  'Резервен автомобил за зимния сезон.',
  null,
  'Предстои смяна на гуми и годишен технически преглед. Шофьорът докладва вибрации над 90 км/ч, нужна е проверка на баланса и окачването преди следващия дълъг курс.',
  'Двоен кабинен влекач.',
  null,
  'Lease contract until 2027.',
];

function vehicleId(index: number): string {
  return `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

function createdAt(index: number): string {
  // Two days apart from a fixed date; no wall clock is involved.
  return new Date(Date.UTC(2026, 0, 5) + index * 2 * 86_400_000).toISOString();
}

function seedVehicles(branchId: string, count: number, offset: number): FixtureVehicle[] {
  return Array.from({ length: count }, (_, position) => {
    const index = position + offset;
    const region = regions[index % regions.length] ?? 'CA';
    const letters = series[(index * 7) % series.length] ?? 'AB';
    const digits = String(1000 + ((index * 379) % 9000)).padStart(4, '0');
    return {
      __typename: 'FleetVehicle',
      id: vehicleId(index),
      branchId,
      licensePlate: `${region} ${digits} ${letters}`,
      notes: notes[index % notes.length] ?? null,
      createdAt: createdAt(index),
      updatedAt: createdAt(index),
    };
  });
}

let vehicles: FixtureVehicle[] = [];
let nextIndex = 0;

/** Restores the initial fleet; `empty` starts the default branch without vehicles. */
export function resetFleetFixtures(options: { empty?: boolean } = {}): void {
  const [sofia, plovdiv] = fixtureBranches;
  vehicles = [
    ...(options.empty ? [] : seedVehicles(sofia.id, 45, 0)),
    ...seedVehicles(plovdiv.id, 12, 100),
  ];
  nextIndex = 200;
  revision = 0;
}

function branchOf(variables: FixtureVariables): string {
  // Mirrors the server: business data is always read within the x-branch-id scope.
  if (!variables.branchId)
    throw new FixtureGraphqlError('Branch context is required.', { code: 'BAD_REQUEST' });
  return variables.branchId;
}

function scoped(variables: FixtureVariables): FixtureVehicle[] {
  const branchId = branchOf(variables);
  return vehicles.filter((vehicle) => vehicle.branchId === branchId);
}

function findVehicle(variables: FixtureVariables): FixtureVehicle {
  const id = variables.requiredString('id');
  const vehicle = scoped(variables).find((candidate) => candidate.id === id);
  if (!vehicle) throw new FixtureGraphqlError('Vehicle not found.', { code: 'NOT_FOUND' });
  return vehicle;
}

let revision = 0;

function revisedAt(): string {
  // Each write in a story advances a fixed clock by one minute.
  return new Date(Date.UTC(2026, 9, 1, 9) + revision++ * 60_000).toISOString();
}

function validated(input: FixtureVariables, partial: boolean) {
  const licensePlate = input.string('licensePlate');
  const notesValue = input.string('notes');
  const fieldErrors: { path: string; message: string }[] = [];
  if (!partial || input.has('licensePlate')) {
    const plate = licensePlate?.trim() ?? '';
    if (!plate) fieldErrors.push({ path: 'licensePlate', message: 'License plate is required.' });
    else if (Array.from(plate).length > 32)
      fieldErrors.push({ path: 'licensePlate', message: 'License plate is too long.' });
  }
  if (notesValue !== null && Array.from(notesValue.trim()).length > 2000)
    fieldErrors.push({ path: 'notes', message: 'Notes are too long.' });
  if (fieldErrors.length)
    throw new FixtureGraphqlError('Invalid vehicle.', { code: 'BAD_USER_INPUT', fieldErrors });
  return {
    licensePlate: licensePlate?.trim() ?? null,
    notes: notesValue === null ? null : notesValue.trim() || null,
  };
}

graphqlFixture(AdminVehiclesDocument, (variables) => {
  const search = variables.string('search')?.trim().toLocaleLowerCase('bg') ?? '';
  const ids = variables.strings('ids');
  const sort = variables.object('sort');
  const field = sort.string('field') ?? 'CREATED_AT';
  const direction = sort.string('direction') === 'ASC' ? 1 : -1;
  const offset = variables.int('offset', 0);
  const limit = variables.int('limit', 20);
  const matching = scoped(variables)
    .filter((vehicle) => !search || vehicle.licensePlate.toLocaleLowerCase('bg').includes(search))
    .filter((vehicle) => !ids || ids.includes(vehicle.id))
    .sort((left, right) => {
      const primary =
        field === 'LICENSE_PLATE'
          ? left.licensePlate.localeCompare(right.licensePlate, 'bg')
          : left.createdAt.localeCompare(right.createdAt);
      return primary * direction || right.id.localeCompare(left.id);
    });
  return {
    fleetVehicles: {
      __typename: 'FleetVehiclePage',
      items: matching.slice(offset, offset + limit),
      total: matching.length,
      offset,
      limit,
    },
  };
});

graphqlFixture(AdminVehicleDocument, (variables) => ({ fleetVehicle: findVehicle(variables) }));

graphqlFixture(AdminCreateVehicleDocument, (variables) => {
  const branchId = branchOf(variables);
  const input = validated(variables.object('input'), false);
  const timestamp = revisedAt();
  const vehicle: FixtureVehicle = {
    __typename: 'FleetVehicle',
    id: vehicleId(nextIndex++),
    branchId,
    licensePlate: input.licensePlate ?? '',
    notes: input.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  vehicles = [...vehicles, vehicle];
  return { createFleetVehicle: vehicle };
});

graphqlFixture(AdminUpdateVehicleDocument, (variables) => {
  const current = findVehicle(variables);
  const input = validated(variables.object('input'), true);
  const updated: FixtureVehicle = {
    ...current,
    licensePlate: input.licensePlate ?? current.licensePlate,
    notes: variables.object('input').has('notes') ? input.notes : current.notes,
    updatedAt: revisedAt(),
  };
  vehicles = vehicles.map((vehicle) => (vehicle.id === updated.id ? updated : vehicle));
  return { updateFleetVehicle: updated };
});

graphqlFixture(AdminDeleteVehicleDocument, (variables) => {
  const vehicle = findVehicle(variables);
  vehicles = vehicles.filter((candidate) => candidate.id !== vehicle.id);
  return { deleteFleetVehicle: vehicle };
});

resetFleetFixtures();
