import type { GridColDef } from '@mui/x-data-grid';
import { venuesResource } from '../../../data/data-provider.js';
import type { ReferenceVenueDetailsFragment } from '../../../generated/graphql/operations.js';
import { LookupList } from '../lookup-list.js';

const columns: GridColDef<ReferenceVenueDetailsFragment>[] = [
  { field: 'city', headerName: 'City', flex: 1.2, minWidth: 140 },
  { field: 'countryCode', headerName: 'Country', flex: 0.7, minWidth: 100 },
  {
    field: 'capacity',
    headerName: 'Capacity',
    type: 'number',
    flex: 0.8,
    minWidth: 110,
    valueFormatter: (value: number | null) => value ?? '—',
  },
];

export function VenueList({
  storeId,
  onDeleted,
}: {
  storeId: string;
  onDeleted: (count: number) => void;
}) {
  return (
    <LookupList<ReferenceVenueDetailsFragment>
      resource={venuesResource(storeId)}
      title="Venues"
      singular="venue"
      columns={columns}
      deletionHint="Venues used by events cannot be deleted."
      onDeleted={onDeleted}
    />
  );
}
