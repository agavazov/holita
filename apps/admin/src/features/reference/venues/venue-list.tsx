import type { GridColDef } from '@mui/x-data-grid';
import { venuesResource } from '../../../data/data-provider.js';
import type { ReferenceVenueDetailsFragment } from '../../../generated/graphql/operations.js';
import { useLocalization } from '../../../localization/localization-provider.js';
import { LookupList } from '../lookup-list.js';

export function VenueList({
  storeId,
  onDeleted,
}: {
  storeId: string;
  onDeleted: (count: number) => void;
}) {
  const { t } = useLocalization();
  const columns: GridColDef<ReferenceVenueDetailsFragment>[] = [
    { field: 'city', headerName: t('reference.city'), flex: 1.2, minWidth: 140 },
    { field: 'countryCode', headerName: t('reference.country'), flex: 0.7, minWidth: 100 },
    {
      field: 'capacity',
      headerName: t('reference.capacity'),
      type: 'number',
      flex: 0.8,
      minWidth: 110,
      valueFormatter: (value: number | null) => value ?? '—',
    },
  ];

  return (
    <LookupList<ReferenceVenueDetailsFragment>
      resource={venuesResource(storeId)}
      title={t('reference.venues')}
      singular={t('reference.venue')}
      columns={columns}
      deletionHint={t('reference.venueDeletionHint')}
      onDeleted={onDeleted}
    />
  );
}
