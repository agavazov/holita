import { Tag } from 'antd';
import { tagsResource } from '../../../data/data-provider.js';
import type { ReferenceTagDetailsFragment } from '../../../generated/graphql/operations.js';
import { LookupList } from '../lookup-list.js';

export function TagList({ storeId, onDeleted }: { storeId: string; onDeleted: () => void }) {
  return (
    <LookupList<ReferenceTagDetailsFragment>
      resource={tagsResource(storeId)}
      title="Tags"
      singular="tag"
      onDeleted={onDeleted}
      columns={[
        {
          title: 'Color',
          dataIndex: 'color',
          render: (value: string) => <Tag color={value}>{value}</Tag>,
        },
      ]}
    />
  );
}
