import { venuesResource } from '../../../data/data-provider.js';
import type { ReferenceVenueDetailsFragment } from '../../../generated/graphql/operations.js';
import { LookupList } from '../lookup-list.js';

export function VenueList({ storeId, onDeleted }: { storeId: string; onDeleted: () => void }) {
  return (
    <LookupList<ReferenceVenueDetailsFragment>
      resource={venuesResource(storeId)}
      title="Venues"
      singular="venue"
      onDeleted={onDeleted}
      columns={[
        { title: 'City', dataIndex: 'city' },
        { title: 'Country', dataIndex: 'countryCode' },
        {
          title: 'Capacity',
          dataIndex: 'capacity',
          render: (value: number | null) => value ?? '—',
        },
      ]}
    />
  );
}
