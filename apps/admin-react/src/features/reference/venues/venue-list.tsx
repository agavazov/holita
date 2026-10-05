import { useFormat } from '../../../i18n/use-format.js';
import { useTranslation } from 'react-i18next';
import type { GridColDef } from '@mui/x-data-grid';
import { venuesResource } from '../../../data/data-provider.js';
import type { ReferenceVenueDetailsFragment } from '../../../generated/graphql/operations.js';
import { LookupList } from '../lookup-list.js';

export function VenueList({
  storeId,
  onDeleted,
}: {
  storeId: string;
  onDeleted: (count: number) => void;
}) {
  const format = useFormat();
  const { t } = useTranslation('reference');
  const columns: GridColDef<ReferenceVenueDetailsFragment>[] = [
    { field: 'city', headerName: t('fields.city'), flex: 1.2, minWidth: 140 },
    { field: 'countryCode', headerName: t('fields.country'), flex: 0.7, minWidth: 100 },
    {
      field: 'capacity',
      headerName: t('fields.capacity'),
      type: 'number',
      flex: 0.8,
      minWidth: 110,
      valueFormatter: (value: number | null) => (value === null ? '—' : format.number(value)),
    },
  ];

  return (
    <LookupList<ReferenceVenueDetailsFragment>
      resource={venuesResource(storeId)}
      entity="venues"
      columns={columns}
      onDeleted={onDeleted}
    />
  );
}
