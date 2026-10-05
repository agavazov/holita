import { DataError } from '../data/data-error.js';
import type {
  CreateReferenceTagInput,
  UpdateReferenceTagInput,
  ReferenceTagDetailsFragment,
  ListReferenceTagsQueryVariables,
} from '../generated/graphql/operations.js';
import type { PrototypePersistence } from './snapshot.js';
import {
  uuid,
  text,
  color as tagColor,
  boolean as tagActive,
  validRecord,
  validText,
  invalid,
  pagination,
  lookup,
  direction,
  requireStore,
  uniqueName,
} from './validation.js';

export function validTag(value: unknown): value is ReferenceTagDetailsFragment {
  return (
    validRecord(value) &&
    'name' in value &&
    validText(value.name, 100) &&
    'color' in value &&
    typeof value.color === 'string' &&
    /^#[0-9a-f]{6}$/.test(value.color) &&
    'active' in value &&
    typeof value.active === 'boolean'
  );
}
export function createTagState({ read, write }: PrototypePersistence) {
  function find(tags: ReferenceTagDetailsFragment[], storeId: string, id: unknown) {
    const recordId = uuid(id, 'id');
    const row = tags.find((tag) => tag.storeId === storeId && tag.id === recordId);
    if (!row) throw new DataError('Tag not found');
    return row;
  }
  return {
    listTags: (storeId: unknown, args: ListReferenceTagsQueryVariables) => {
      const scopedStore = uuid(storeId, 'x-store-id'),
        { offset, limit } = pagination(args),
        filter = lookup(args),
        field = args.sort?.field ?? 'CREATED_AT',
        order = direction(args.sort?.direction);
      if (!['NAME', 'COLOR', 'ACTIVE', 'CREATED_AT'].includes(field))
        invalid('sort.field', 'Choose a supported tag sort field.');
      const rows = read().tags.filter(
        (tag) =>
          tag.storeId === scopedStore &&
          (!filter.search || tag.name.toLowerCase().includes(filter.search)) &&
          (filter.active === undefined || tag.active === filter.active) &&
          (!filter.ids || filter.ids.includes(tag.id)),
      );
      rows.sort((left, right) => {
        const comparison =
          field === 'ACTIVE'
            ? Number(right.active) - Number(left.active)
            : field === 'NAME'
              ? left.name.localeCompare(right.name)
              : field === 'COLOR'
                ? left.color.localeCompare(right.color)
                : left.createdAt.localeCompare(right.createdAt);
        return comparison * order || right.id.localeCompare(left.id);
      });
      return { items: rows.slice(offset, offset + limit), total: rows.length, offset, limit };
    },
    getTag: (storeId: unknown, id: unknown) => find(read().tags, uuid(storeId, 'x-store-id'), id),
    createTag: (storeId: unknown, input: CreateReferenceTagInput) => {
      const snapshot = read();
      const now = new Date().toISOString();
      const scopedStore = uuid(storeId, 'x-store-id');
      requireStore(scopedStore);
      const row: ReferenceTagDetailsFragment = {
        id: crypto.randomUUID(),
        storeId: scopedStore,
        name: text(input.name, 'name', 100),
        color: tagColor(input.color),
        active: tagActive(input.active === undefined ? true : input.active),
        createdAt: now,
        updatedAt: now,
      };
      uniqueName(snapshot.tags, row);
      write({ ...snapshot, tags: [...snapshot.tags, row] });
      return row;
    },
    updateTag: (storeId: unknown, id: unknown, input: UpdateReferenceTagInput) => {
      const snapshot = read();
      const previous = find(snapshot.tags, uuid(storeId, 'x-store-id'), id);
      if (input.name === undefined && input.color === undefined && input.active === undefined)
        throw new DataError('Provide at least one tag field to update');
      const row = {
        ...previous,
        ...(input.name !== undefined ? { name: text(input.name, 'name', 100) } : {}),
        ...(input.color !== undefined ? { color: tagColor(input.color) } : {}),
        ...(input.active !== undefined ? { active: tagActive(input.active) } : {}),
        updatedAt: new Date().toISOString(),
      };
      uniqueName(snapshot.tags, row);
      write({ ...snapshot, tags: snapshot.tags.map((tag) => (tag.id === row.id ? row : tag)) });
      return row;
    },
    deleteTag: (storeId: unknown, id: unknown) => {
      const snapshot = read();
      const row = find(snapshot.tags, uuid(storeId, 'x-store-id'), id);
      if (
        snapshot.events.some(
          (event) => event.storeId === row.storeId && event.tagIds.includes(row.id),
        )
      )
        throw new DataError('Tag is still referenced by another record.');
      write({ ...snapshot, tags: snapshot.tags.filter((tag) => tag.id !== row.id) });
      return row;
    },
  };
}
