import type { GridColDef } from '@mui/x-data-grid';
import { speakersResource } from '../../../data/data-provider.js';
import type { ReferenceSpeakerDetailsFragment } from '../../../generated/graphql/operations.js';
import { useLocalization } from '../../../localization/localization-provider.js';
import { LookupList } from '../lookup-list.js';

export function SpeakerList({
  storeId,
  onDeleted,
}: {
  storeId: string;
  onDeleted: (count: number) => void;
}) {
  const { t } = useLocalization();
  const columns: GridColDef<ReferenceSpeakerDetailsFragment>[] = [
    {
      field: 'email',
      headerName: t('reference.email'),
      flex: 1.5,
      minWidth: 220,
      valueFormatter: (value: string | null) => value ?? '—',
    },
  ];

  return (
    <LookupList<ReferenceSpeakerDetailsFragment>
      resource={speakersResource(storeId)}
      title={t('shell.speakers')}
      singular={t('reference.speaker')}
      columns={columns}
      deletionHint={t('reference.speakerDeletionHint')}
      onDeleted={onDeleted}
    />
  );
}
