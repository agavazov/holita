import { DataError } from '../data/data-error.js';
import {
  initialProducts,
  initialVenues,
  initialSpeakers,
  initialTags,
  prototypeStores,
  initialEvents,
  initialSessions,
  initialHistory,
} from './fixtures.js';
import { createProductState, validProduct } from './products.js';
import { createVenueState, validVenue } from './venues.js';
import { createSpeakerState, validSpeaker } from './speakers.js';
import { createTagState, validTag } from './tags.js';
import type { PrototypeSnapshot } from './snapshot.js';
import { distinctRecords } from './validation.js';
import { createEventState } from './events.js';
import { createSessionState } from './sessions.js';
import { validEvent, validSession, validHistory, validEventRelations } from './event-snapshot.js';
import { createMediaState } from './media.js';
import { initialMedia } from './media-fixtures.js';
import { validMedia, validMediaRelations } from './media-validation.js';
import type { PrototypeMediaStorage } from './media-storage.js';

export const prototypeStorageKey = 'holita.prototype.data';
const version = 4;
type PrototypeStorage = Pick<Storage, 'getItem' | 'setItem'>;
function fixtures(): PrototypeSnapshot {
  const events = initialEvents();
  return {
    version,
    products: initialProducts(),
    venues: initialVenues(),
    speakers: initialSpeakers(),
    tags: initialTags(),
    events,
    sessions: initialSessions(events),
    history: initialHistory(events),
    media: initialMedia(events),
  };
}
function validSnapshot(value: unknown): value is PrototypeSnapshot {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    value.version !== version ||
    !('products' in value) ||
    !Array.isArray(value.products) ||
    !value.products.every(validProduct) ||
    !('venues' in value) ||
    !Array.isArray(value.venues) ||
    !value.venues.every(validVenue) ||
    !('speakers' in value) ||
    !Array.isArray(value.speakers) ||
    !value.speakers.every(validSpeaker) ||
    !('tags' in value) ||
    !Array.isArray(value.tags) ||
    !value.tags.every(validTag) ||
    !('events' in value) ||
    !Array.isArray(value.events) ||
    !value.events.every(validEvent) ||
    !('sessions' in value) ||
    !Array.isArray(value.sessions) ||
    !value.sessions.every(validSession) ||
    !('history' in value) ||
    !Array.isArray(value.history) ||
    !value.history.every(validHistory) ||
    !('media' in value) ||
    !Array.isArray(value.media) ||
    !value.media.every(validMedia)
  )
    return false;
  const snapshot: PrototypeSnapshot = {
    version,
    products: value.products,
    venues: value.venues,
    speakers: value.speakers,
    tags: value.tags,
    events: value.events,
    sessions: value.sessions,
    history: value.history,
    media: value.media,
  };
  return (
    distinctRecords(
      value.products,
      value.products.map((row) => JSON.stringify([row.storeId, row.sku])),
    ) &&
    distinctRecords(
      value.venues,
      value.venues.map((row) => JSON.stringify([row.storeId, row.name])),
    ) &&
    distinctRecords(
      value.speakers,
      value.speakers.map((row) => JSON.stringify([row.storeId, row.name])),
    ) &&
    distinctRecords(
      value.tags,
      value.tags.map((row) => JSON.stringify([row.storeId, row.name])),
    ) &&
    validEventRelations(snapshot) &&
    validMediaRelations(snapshot)
  );
}
export function createPrototypeState(
  storage: PrototypeStorage,
  imageStorage?: PrototypeMediaStorage,
) {
  function write(snapshot: PrototypeSnapshot) {
    try {
      storage.setItem(prototypeStorageKey, JSON.stringify(snapshot));
    } catch {
      throw new DataError(
        'Prototype changes could not be saved. Check browser storage and try again.',
      );
    }
  }
  function read(): PrototypeSnapshot {
    let raw: string | null;
    try {
      raw = storage.getItem(prototypeStorageKey);
    } catch {
      throw new DataError('Prototype requires browser storage. Enable it and reload.');
    }
    if (raw !== null) {
      try {
        const value: unknown = JSON.parse(raw);
        if (validSnapshot(value)) return value;
      } catch {
        // Invalid or obsolete demo data is replaced with the versioned fixtures.
      }
    }
    const snapshot = fixtures();
    write(snapshot);
    return snapshot;
  }
  read();
  const media = createMediaState({ read, write }, imageStorage);
  return {
    reset: () => {
      write(fixtures());
      media.resetMedia();
    },
    listStores: () =>
      structuredClone(prototypeStores).sort(
        (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
      ),
    ...createProductState({ read, write }),
    ...createVenueState({ read, write }),
    ...createSpeakerState({ read, write }),
    ...createTagState({ read, write }),
    ...createEventState({ read, write }),
    ...createSessionState({ read, write }),
    ...media,
  };
}
export type PrototypeState = ReturnType<typeof createPrototypeState>;
