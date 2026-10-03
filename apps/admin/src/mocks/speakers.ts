import isEmail from 'validator/lib/isEmail.js';
import { DataError } from '../data/data-error.js';
import type {
  CreateReferenceSpeakerInput,
  UpdateReferenceSpeakerInput,
  ReferenceSpeakerDetailsFragment,
  ListReferenceSpeakersQueryVariables,
} from '../generated/graphql/operations.js';
import type { PrototypePersistence } from './snapshot.js';
import {
  uuid,
  text,
  optionalText,
  boolean,
  email,
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

export function validSpeaker(value: unknown): value is ReferenceSpeakerDetailsFragment {
  return (
    validRecord(value) &&
    'name' in value &&
    validText(value.name, 200) &&
    'email' in value &&
    validOptionalText(value.email, 254) &&
    (value.email === null || isEmail(value.email)) &&
    'shortBio' in value &&
    validOptionalText(value.shortBio, 2000) &&
    'active' in value &&
    typeof value.active === 'boolean'
  );
}
export function createSpeakerState({ read, write }: PrototypePersistence) {
  function find(rows: ReferenceSpeakerDetailsFragment[], storeId: string, id: unknown) {
    const recordId = uuid(id, 'id'),
      row = rows.find((speaker) => speaker.storeId === storeId && speaker.id === recordId);
    if (!row) throw new DataError('Speaker not found');
    return row;
  }
  return {
    listSpeakers: (storeId: unknown, args: ListReferenceSpeakersQueryVariables) => {
      const store = uuid(storeId, 'x-store-id'),
        { offset, limit } = pagination(args),
        filter = lookup(args),
        field = args.sort?.field ?? 'CREATED_AT',
        order = direction(args.sort?.direction);
      if (!['NAME', 'EMAIL', 'ACTIVE', 'CREATED_AT'].includes(field))
        invalid('sort.field', 'Choose a supported speaker sort field.');
      const rows = read().speakers.filter(
        (row) =>
          row.storeId === store &&
          (!filter.search || row.name.toLowerCase().includes(filter.search)) &&
          (filter.active === undefined || row.active === filter.active) &&
          (!filter.ids || filter.ids.includes(row.id)),
      );
      rows.sort((left, right) => {
        if (field === 'EMAIL') {
          if (left.email === null && right.email !== null) return 1;
          if (right.email === null && left.email !== null) return -1;
        }
        const comparison =
          field === 'NAME'
            ? left.name.localeCompare(right.name)
            : field === 'EMAIL'
              ? (left.email ?? '').localeCompare(right.email ?? '')
              : field === 'ACTIVE'
                ? Number(right.active) - Number(left.active)
                : left.createdAt.localeCompare(right.createdAt);
        return comparison * order || right.id.localeCompare(left.id);
      });
      return { items: rows.slice(offset, offset + limit), total: rows.length, offset, limit };
    },
    getSpeaker: (storeId: unknown, id: unknown) =>
      find(read().speakers, uuid(storeId, 'x-store-id'), id),
    createSpeaker: (storeId: unknown, input: CreateReferenceSpeakerInput) => {
      const store = uuid(storeId, 'x-store-id'),
        snapshot = read(),
        now = new Date().toISOString();
      const row: ReferenceSpeakerDetailsFragment = {
        id: crypto.randomUUID(),
        storeId: store,
        name: text(input.name, 'name', 200),
        email: email(input.email),
        shortBio: optionalText(input.shortBio, 'shortBio', 2000),
        active: boolean(input.active === undefined ? true : input.active),
        createdAt: now,
        updatedAt: now,
      };
      requireStore(store);
      uniqueName(snapshot.speakers, row);
      write({ ...snapshot, speakers: [...snapshot.speakers, row] });
      return row;
    },
    updateSpeaker: (storeId: unknown, id: unknown, input: UpdateReferenceSpeakerInput) => {
      const store = uuid(storeId, 'x-store-id'),
        snapshot = read();
      const changes = {
        ...(input.name !== undefined ? { name: text(input.name, 'name', 200) } : {}),
        ...(input.email !== undefined ? { email: email(input.email) } : {}),
        ...(input.shortBio !== undefined
          ? { shortBio: optionalText(input.shortBio, 'shortBio', 2000) }
          : {}),
        ...(input.active !== undefined ? { active: boolean(input.active) } : {}),
      };
      if (!Object.keys(changes).length)
        throw new DataError('Provide at least one speaker field to update');
      const row = {
        ...find(snapshot.speakers, store, id),
        ...changes,
        updatedAt: new Date().toISOString(),
      };
      uniqueName(snapshot.speakers, row);
      write({
        ...snapshot,
        speakers: snapshot.speakers.map((speaker) => (speaker.id === row.id ? row : speaker)),
      });
      return row;
    },
    deleteSpeaker: (storeId: unknown, id: unknown) => {
      const snapshot = read(),
        row = find(snapshot.speakers, uuid(storeId, 'x-store-id'), id);
      if (
        snapshot.sessions.some(
          (session) => session.storeId === row.storeId && session.speakerIds.includes(row.id),
        )
      )
        throw new DataError('Speaker is still referenced by another record.');
      write({
        ...snapshot,
        speakers: snapshot.speakers.filter((speaker) => speaker.id !== row.id),
      });
      return row;
    },
  };
}
