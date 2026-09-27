import { speakersResource } from '../../../data/data-provider.js';
import type { ReferenceSpeakerDetailsFragment } from '../../../generated/graphql/operations.js';
import { LookupList } from '../lookup-list.js';

export function SpeakerList({ storeId, onDeleted }: { storeId: string; onDeleted: () => void }) {
  return (
    <LookupList<ReferenceSpeakerDetailsFragment>
      resource={speakersResource(storeId)}
      title="Speakers"
      singular="speaker"
      onDeleted={onDeleted}
      columns={[
        { title: 'Email', dataIndex: 'email', render: (value: string | null) => value ?? '—' },
      ]}
    />
  );
}
