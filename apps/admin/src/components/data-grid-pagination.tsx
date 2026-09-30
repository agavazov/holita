// Aurora DataGridPagination / CustomTablePaginationAction; bounded server pagination.
import { Box, Button, Stack, TablePagination, Typography } from '@mui/material';
import type { TablePaginationActionsProps } from '@mui/material/TablePaginationActions';
import type { GridSlotProps } from '@mui/x-data-grid';
import IconifyIcon from '../layout/primitives/iconify-icon.js';

function PaginationActions({
  page,
  rowsPerPage,
  count,
  disabled,
  onPageChange,
}: TablePaginationActionsProps) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', ml: 'auto', gap: 0.5 }}>
      <Button
        size="small"
        aria-label="Previous page"
        disabled={disabled || page === 0}
        onClick={() => {
          onPageChange(null, page - 1);
        }}
        sx={{ minWidth: 32 }}
      >
        <IconifyIcon icon="material-symbols:chevron-left-rounded" sx={{ fontSize: 18 }} />
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          Previous
        </Box>
      </Button>
      <Button
        size="small"
        aria-label="Next page"
        disabled={disabled || (page + 1) * rowsPerPage >= count}
        onClick={() => {
          onPageChange(null, page + 1);
        }}
        sx={{ minWidth: 32 }}
      >
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          Next
        </Box>
        <IconifyIcon icon="material-symbols:chevron-right-rounded" sx={{ fontSize: 18 }} />
      </Button>
    </Stack>
  );
}

export default function DataGridPagination({
  onRowsPerPageChange,
  ...props
}: GridSlotProps['basePagination']) {
  return (
    <TablePagination
      {...props}
      component="div"
      onRowsPerPageChange={(event) => {
        onRowsPerPageChange?.(Number(event.target.value));
      }}
      labelRowsPerPage="Rows"
      labelDisplayedRows={({ from, to, count }) => (
        <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Showing{' '}
          </Box>
          <Box component="strong">
            {count < 0 ? '…' : `${String(from)}–${String(to)} of ${String(count)}`}
          </Box>
        </Typography>
      )}
      ActionsComponent={PaginationActions}
      sx={{
        '& .MuiTablePagination-toolbar': {
          px: { xs: 1, sm: 3 },
          minHeight: 46,
          flexWrap: 'wrap',
          gap: 0.5,
        },
        '& .MuiTablePagination-spacer': { display: 'none' },
        '& .MuiTablePagination-selectLabel': { fontSize: 12 },
        '& .MuiTablePagination-input': { ml: 0, mr: 1 },
        '& .MuiTablePagination-displayedRows': { mr: 'auto' },
      }}
    />
  );
}
