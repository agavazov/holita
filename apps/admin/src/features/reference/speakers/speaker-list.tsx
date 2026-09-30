import type { GridColDef } from '@mui/x-data-grid';
import { speakersResource } from '../../../data/data-provider.js';
import type { ReferenceSpeakerDetailsFragment } from '../../../generated/graphql/operations.js';
import { LookupList } from '../lookup-list.js';

const columns: GridColDef<ReferenceSpeakerDetailsFragment>[] = [
  {
    field: 'email',
    headerName: 'Email',
    flex: 1.5,
    minWidth: 220,
    valueFormatter: (value: string | null) => value ?? '—',
  },
];

export function SpeakerList({
  storeId,
  onDeleted,
}: {
  storeId: string;
  onDeleted: (count: number) => void;
}) {
  return (
    <LookupList<ReferenceSpeakerDetailsFragment>
      resource={speakersResource(storeId)}
      title="Speakers"
      singular="speaker"
      columns={columns}
      deletionHint="Speakers assigned to sessions cannot be deleted."
      onDeleted={onDeleted}
    />
  );
}
