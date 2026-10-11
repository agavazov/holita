import { PrototypeError } from './prototype-error';
import type {
  CreateReferenceVehicleInput,
  UpdateReferenceVehicleInput,
  AdminVehicleFragment,
  AdminVehiclesQueryVariables,
} from '../../generated/graphql/operations';
import type { PrototypePersistence } from './snapshot';
import {
  uuid,
  text,
  optionalText,
  pagination,
  ids,
  direction,
  requireStore,
  validRecord,
  validText,
  validOptionalText,
  invalid,
} from './validation';

export function validVehicle(value: unknown): value is AdminVehicleFragment {
  return (
    validRecord(value) &&
    'licensePlate' in value &&
    validText(value.licensePlate, 32) &&
    'notes' in value &&
    validOptionalText(value.notes, 2000)
  );
}
export function createVehicleState({ read, write }: PrototypePersistence) {
  function find(rows: AdminVehicleFragment[], storeId: string, id: unknown) {
    const recordId = uuid(id, 'id'),
      row = rows.find((vehicle) => vehicle.storeId === storeId && vehicle.id === recordId);
    if (!row) throw new PrototypeError('Vehicle not found');
    return row;
  }
  return {
    listVehicles: (storeId: unknown, args: AdminVehiclesQueryVariables) => {
      const store = uuid(storeId, 'x-store-id'),
        { offset, limit } = pagination(args),
        filter = {
          search: optionalText(args.search, 'search', 200)?.toLowerCase(),
          ids: args.ids == null ? undefined : ids(args.ids, 'ids'),
        },
        field = args.sort?.field ?? 'CREATED_AT',
        order = direction(args.sort?.direction);
      if (!['LICENSE_PLATE', 'CREATED_AT'].includes(field))
        invalid('sort.field', 'Choose a supported vehicle sort field.');
      const rows = read().vehicles.filter(
        (row) =>
          row.storeId === store &&
          (!filter.search || row.licensePlate.toLowerCase().includes(filter.search)) &&
          (!filter.ids || filter.ids.includes(row.id)),
      );
      rows.sort((left, right) => {
        const comparison =
          field === 'LICENSE_PLATE'
            ? left.licensePlate.localeCompare(right.licensePlate)
            : left.createdAt.localeCompare(right.createdAt);
        return comparison * order || right.id.localeCompare(left.id);
      });
      return { items: rows.slice(offset, offset + limit), total: rows.length, offset, limit };
    },
    getVehicle: (storeId: unknown, id: unknown) =>
      find(read().vehicles, uuid(storeId, 'x-store-id'), id),
    createVehicle: (storeId: unknown, input: CreateReferenceVehicleInput) => {
      const store = uuid(storeId, 'x-store-id'),
        snapshot = read(),
        now = new Date().toISOString();
      const row: AdminVehicleFragment = {
        id: crypto.randomUUID(),
        storeId: store,
        licensePlate: text(input.licensePlate, 'licensePlate', 32),
        notes: optionalText(input.notes, 'notes', 2000),
        createdAt: now,
        updatedAt: now,
      };
      requireStore(store);
      write({ ...snapshot, vehicles: [...snapshot.vehicles, row] });
      return row;
    },
    updateVehicle: (storeId: unknown, id: unknown, input: UpdateReferenceVehicleInput) => {
      const store = uuid(storeId, 'x-store-id'),
        snapshot = read();
      const changes = {
        ...(input.licensePlate !== undefined
          ? { licensePlate: text(input.licensePlate, 'licensePlate', 32) }
          : {}),
        ...(input.notes !== undefined ? { notes: optionalText(input.notes, 'notes', 2000) } : {}),
      };
      if (!Object.keys(changes).length)
        throw new PrototypeError('Provide at least one vehicle field to update');
      const row = {
        ...find(snapshot.vehicles, store, id),
        ...changes,
        updatedAt: new Date().toISOString(),
      };
      write({
        ...snapshot,
        vehicles: snapshot.vehicles.map((vehicle) => (vehicle.id === row.id ? row : vehicle)),
      });
      return row;
    },
    deleteVehicle: (storeId: unknown, id: unknown) => {
      const snapshot = read(),
        row = find(snapshot.vehicles, uuid(storeId, 'x-store-id'), id);
      write({
        ...snapshot,
        vehicles: snapshot.vehicles.filter((vehicle) => vehicle.id !== row.id),
      });
      return row;
    },
  };
}
