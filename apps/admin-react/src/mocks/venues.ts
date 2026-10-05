import { DataError } from '../data/data-error.js';
import type {
  CreateReferenceVenueInput,
  UpdateReferenceVenueInput,
  ReferenceVenueDetailsFragment,
  ListReferenceVenuesQueryVariables,
} from '../generated/graphql/operations.js';
import type { PrototypePersistence } from './snapshot.js';
import {
  uuid,
  text,
  optionalText,
  boolean,
  countryCode,
  capacity,
  pagination,
  lookup,
  direction,
  requireStore,
  uniqueName,
  validRecord,
  validText,
  validOptionalText,
  invalid,
} from './validation.js';

export function validVenue(value: unknown): value is ReferenceVenueDetailsFragment {
  return (
    validRecord(value) &&
    'name' in value &&
    validText(value.name, 200) &&
    'description' in value &&
    validOptionalText(value.description, 2000) &&
    'city' in value &&
    validText(value.city, 120) &&
    'countryCode' in value &&
    typeof value.countryCode === 'string' &&
    /^[A-Z]{2}$/.test(value.countryCode) &&
    'address' in value &&
    validOptionalText(value.address, 300) &&
    'capacity' in value &&
    (value.capacity === null ||
      (typeof value.capacity === 'number' &&
        Number.isInteger(value.capacity) &&
        value.capacity >= 1 &&
        value.capacity <= 2147483647)) &&
    'active' in value &&
    typeof value.active === 'boolean'
  );
}
export function createVenueState({ read, write }: PrototypePersistence) {
  function find(rows: ReferenceVenueDetailsFragment[], storeId: string, id: unknown) {
    const recordId = uuid(id, 'id'),
      row = rows.find((venue) => venue.storeId === storeId && venue.id === recordId);
    if (!row) throw new DataError('Venue not found');
    return row;
  }
  return {
    listVenues: (storeId: unknown, args: ListReferenceVenuesQueryVariables) => {
      const store = uuid(storeId, 'x-store-id'),
        { offset, limit } = pagination(args),
        filter = lookup(args),
        field = args.sort?.field ?? 'CREATED_AT',
        order = direction(args.sort?.direction);
      if (!['NAME', 'CITY', 'COUNTRY_CODE', 'CAPACITY', 'ACTIVE', 'CREATED_AT'].includes(field))
        invalid('sort.field', 'Choose a supported venue sort field.');
      const rows = read().venues.filter(
        (row) =>
          row.storeId === store &&
          (!filter.search || row.name.toLowerCase().includes(filter.search)) &&
          (filter.active === undefined || row.active === filter.active) &&
          (!filter.ids || filter.ids.includes(row.id)),
      );
      rows.sort((left, right) => {
        if (field === 'CAPACITY') {
          if (left.capacity === null && right.capacity !== null) return 1;
          if (right.capacity === null && left.capacity !== null) return -1;
        }
        const comparison =
          field === 'NAME'
            ? left.name.localeCompare(right.name)
            : field === 'CITY'
              ? left.city.localeCompare(right.city)
              : field === 'COUNTRY_CODE'
                ? left.countryCode.localeCompare(right.countryCode)
                : field === 'CAPACITY'
                  ? (left.capacity ?? 0) - (right.capacity ?? 0)
                  : field === 'ACTIVE'
                    ? Number(right.active) - Number(left.active)
                    : left.createdAt.localeCompare(right.createdAt);
        return comparison * order || right.id.localeCompare(left.id);
      });
      return { items: rows.slice(offset, offset + limit), total: rows.length, offset, limit };
    },
    getVenue: (storeId: unknown, id: unknown) =>
      find(read().venues, uuid(storeId, 'x-store-id'), id),
    createVenue: (storeId: unknown, input: CreateReferenceVenueInput) => {
      const store = uuid(storeId, 'x-store-id'),
        snapshot = read(),
        now = new Date().toISOString();
      const row: ReferenceVenueDetailsFragment = {
        id: crypto.randomUUID(),
        storeId: store,
        name: text(input.name, 'name', 200),
        description: optionalText(input.description, 'description', 2000),
        city: text(input.city, 'city', 120),
        countryCode: countryCode(input.countryCode),
        address: optionalText(input.address, 'address', 300),
        capacity: capacity(input.capacity),
        active: boolean(input.active === undefined ? true : input.active),
        createdAt: now,
        updatedAt: now,
      };
      requireStore(store);
      uniqueName(snapshot.venues, row);
      write({ ...snapshot, venues: [...snapshot.venues, row] });
      return row;
    },
    updateVenue: (storeId: unknown, id: unknown, input: UpdateReferenceVenueInput) => {
      const store = uuid(storeId, 'x-store-id'),
        snapshot = read();
      const changes = {
        ...(input.name !== undefined ? { name: text(input.name, 'name', 200) } : {}),
        ...(input.city !== undefined ? { city: text(input.city, 'city', 120) } : {}),
        ...(input.countryCode !== undefined ? { countryCode: countryCode(input.countryCode) } : {}),
        ...(input.description !== undefined
          ? { description: optionalText(input.description, 'description', 2000) }
          : {}),
        ...(input.address !== undefined
          ? { address: optionalText(input.address, 'address', 300) }
          : {}),
        ...(input.capacity !== undefined ? { capacity: capacity(input.capacity) } : {}),
        ...(input.active !== undefined ? { active: boolean(input.active) } : {}),
      };
      if (!Object.keys(changes).length)
        throw new DataError('Provide at least one venue field to update');
      const row = {
        ...find(snapshot.venues, store, id),
        ...changes,
        updatedAt: new Date().toISOString(),
      };
      uniqueName(snapshot.venues, row);
      write({
        ...snapshot,
        venues: snapshot.venues.map((venue) => (venue.id === row.id ? row : venue)),
      });
      return row;
    },
    deleteVenue: (storeId: unknown, id: unknown) => {
      const snapshot = read(),
        row = find(snapshot.venues, uuid(storeId, 'x-store-id'), id);
      if (
        snapshot.events.some((event) => event.storeId === row.storeId && event.venueId === row.id)
      )
        throw new DataError('Venue is still referenced by another record.');
      write({ ...snapshot, venues: snapshot.venues.filter((venue) => venue.id !== row.id) });
      return row;
    },
  };
}
