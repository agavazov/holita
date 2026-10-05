import type {
  ProductDetailsFragment,
  ReferenceVenueDetailsFragment,
  ReferenceSpeakerDetailsFragment,
  ReferenceTagDetailsFragment,
  ReferenceEventDetailsFragment,
  ReferenceSessionDetailsFragment,
  ListReferenceEventHistoryQuery,
  ReferenceEventMediaDetailsFragment,
} from '../generated/graphql/operations.js';

// Relations are resolved from the current snapshot, so renamed lookup records stay current.
export type PrototypeEvent = Omit<ReferenceEventDetailsFragment, 'venue' | 'tags'>;
export type PrototypeSession = Omit<ReferenceSessionDetailsFragment, 'speakers'>;
export type PrototypeHistoryEntry =
  ListReferenceEventHistoryQuery['referenceEventHistory']['items'][number] & { storeId: string };
export type PrototypeMedia = Omit<
  ReferenceEventMediaDetailsFragment,
  'readUrl' | 'readUrlExpiresAt'
> & {
  storeId: string;
  uploadId: string | null;
  fixture: 'collaboration' | 'workshop' | null;
};

export type PrototypeSnapshot = {
  version: number;
  products: ProductDetailsFragment[];
  venues: ReferenceVenueDetailsFragment[];
  speakers: ReferenceSpeakerDetailsFragment[];
  tags: ReferenceTagDetailsFragment[];
  events: PrototypeEvent[];
  sessions: PrototypeSession[];
  history: PrototypeHistoryEntry[];
  media: PrototypeMedia[];
};

export type PrototypePersistence = {
  read: () => PrototypeSnapshot;
  write: (snapshot: PrototypeSnapshot) => void;
};
