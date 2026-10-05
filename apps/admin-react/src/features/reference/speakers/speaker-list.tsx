import { useTranslation } from 'react-i18next';
import type { GridColDef } from '@mui/x-data-grid';
import { speakersResource } from '../../../data/data-provider.js';
import type { ReferenceSpeakerDetailsFragment } from '../../../generated/graphql/operations.js';
import { LookupList } from '../lookup-list.js';

export function SpeakerList({
  storeId,
  onDeleted,
}: {
  storeId: string;
  onDeleted: (count: number) => void;
}) {
  const { t } = useTranslation('reference');
  const columns: GridColDef<ReferenceSpeakerDetailsFragment>[] = [
    {
      field: 'email',
      headerName: t('fields.email'),
      flex: 1.5,
      minWidth: 220,
      valueFormatter: (value: string | null) => value ?? '—',
    },
  ];

  return (
    <LookupList<ReferenceSpeakerDetailsFragment>
      resource={speakersResource(storeId)}
      entity="speakers"
      columns={columns}
      onDeleted={onDeleted}
    />
  );
}
