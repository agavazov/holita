import type {
  AdminProductFragment,
  AdminVenueFragment,
  AdminSpeakerFragment,
  AdminTagFragment,
  AdminEventDetailsFragment,
  AdminSessionDetailsFragment,
  AdminEventHistoryQuery,
  AdminMediaDetailsFragment,
} from '../../generated/graphql/operations';

// Product selections omit timestamps; persistence retains them for CREATED_AT sorting.
export type PrototypeProduct = AdminProductFragment & {
  createdAt: string;
  updatedAt: string;
};

// Resolve relations from the current snapshot so lookup edits remain visible.
export type PrototypeEvent = Omit<AdminEventDetailsFragment, 'venue' | 'tags'>;
export type PrototypeSession = Omit<AdminSessionDetailsFragment, 'speakers'>;
export type PrototypeHistoryEntry =
  AdminEventHistoryQuery['referenceEventHistory']['items'][number] & { storeId: string };
export type PrototypeMedia = Omit<
  AdminMediaDetailsFragment,
  'readUrl' | 'readUrlExpiresAt' | '__typename'
> & {
  storeId: string;
  uploadId: string | null;
  fixture: 'collaboration' | 'workshop' | null;
};

export interface PrototypeSnapshot {
  version: number;
  products: PrototypeProduct[];
  venues: AdminVenueFragment[];
  speakers: AdminSpeakerFragment[];
  tags: AdminTagFragment[];
  events: PrototypeEvent[];
  sessions: PrototypeSession[];
  history: PrototypeHistoryEntry[];
  media: PrototypeMedia[];
}

export interface PrototypePersistence {
  read: () => PrototypeSnapshot;
  write: (snapshot: PrototypeSnapshot) => void;
}
