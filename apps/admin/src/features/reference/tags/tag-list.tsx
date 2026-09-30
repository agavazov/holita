import { Box, Stack } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { tagsResource } from '../../../data/data-provider.js';
import type { ReferenceTagDetailsFragment } from '../../../generated/graphql/operations.js';
import { LookupList } from '../lookup-list.js';

const columns: GridColDef<ReferenceTagDetailsFragment>[] = [
  {
    field: 'color',
    headerName: 'Color',
    flex: 1,
    minWidth: 160,
    renderCell: ({ row }) => (
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', height: '100%' }}>
        <Box aria-hidden sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: row.color }} />
        {row.color}
      </Stack>
    ),
  },
];

export function TagList({
  storeId,
  onDeleted,
}: {
  storeId: string;
  onDeleted: (count: number) => void;
}) {
  return (
    <LookupList<ReferenceTagDetailsFragment>
      resource={tagsResource(storeId)}
      title="Tags"
      singular="tag"
      columns={columns}
      deletionHint="Tags assigned to events cannot be deleted."
      onDeleted={onDeleted}
    />
  );
}
