import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  DataGrid,
  type GridColDef,
  type GridRowSelectionModel,
  type GridSortModel,
} from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { ContentSection } from '../../../components/content-section.js';
import DataGridPagination from '../../../components/data-grid-pagination.js';
import { FilterDrawer } from '../../../components/filter-drawer.js';
import { RecordActions } from '../../../components/record-actions.js';
import IconifyIcon from '../../../layout/primitives/iconify-icon.js';
import StyledTextField from '../../../layout/primitives/styled-text-field.js';

type ExampleRow = { id: string; name: string; code: string; active: boolean };
const initialRows: ExampleRow[] = [
  'Linen tote',
  'Ceramic mug',
  'Desk notebook',
  'Cotton scarf',
  'Glass bottle',
  'Canvas pouch',
  'Wool blanket',
  'Travel journal',
  'Wooden tray',
  'Garden candle',
  'Leather wallet',
  'Studio pen',
].map((name, index) => ({
  id: String(index + 1),
  name,
  code: `EX-${String(index + 1).padStart(3, '0')}`,
  active: index % 3 !== 0,
}));
const emptySelection = (): GridRowSelectionModel => ({ type: 'include', ids: new Set() });

export function ListExamples() {
  const compact = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState({ page: 0, pageSize: 5 });
  const [sort, setSort] = useState<GridSortModel>([]);
  const [selection, setSelection] = useState(emptySelection);
  const [deleting, setDeleting] = useState<string[]>([]);
  const [viewed, setViewed] = useState<ExampleRow | null>(null);
  const [editor, setEditor] = useState<ExampleRow | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => {
    const result = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(search.toLowerCase()) &&
        (status === 'all' || row.active === (status === 'active')),
    );
    const sorting = sort[0];
    if (!sorting) return result;
    return result.sort((first, second) => {
      const order =
        sorting.field === 'active'
          ? Number(first.active) - Number(second.active)
          : sorting.field === 'code'
            ? first.code.localeCompare(second.code)
            : first.name.localeCompare(second.name);
      return order ? order * (sorting.sort === 'desc' ? -1 : 1) : first.id.localeCompare(second.id);
    });
  }, [rows, search, status, sort]);
  const pageRows = filtered.slice(page.page * page.pageSize, (page.page + 1) * page.pageSize);
  const resetSelection = () => {
    setSelection(emptySelection());
    setPage((current) => ({ ...current, page: 0 }));
  };
  const edit = (row: ExampleRow) => {
    setAttempted(false);
    setEditor({ ...row });
  };
  const columns: GridColDef<ExampleRow>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150,
      renderCell: ({ row }) => (
        <Stack sx={{ justifyContent: 'center', height: '100%', gap: 0.5 }}>
          <Link
            component="button"
            underline="hover"
            onClick={() => {
              edit(row);
            }}
            sx={{ textAlign: 'left' }}
          >
            {row.name}
          </Link>
          {compact && (
            <Chip
              size="small"
              variant="soft"
              color={row.active ? 'success' : 'neutral'}
              label={row.active ? 'Active' : 'Draft'}
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
        </Stack>
      ),
    },
    { field: 'code', headerName: 'Code', width: 140 },
    {
      field: 'active',
      headerName: 'Status',
      width: 120,
      renderCell: ({ row }) => (
        <Chip
          variant="soft"
          color={row.active ? 'success' : 'neutral'}
          label={row.active ? 'Active' : 'Draft'}
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 54,
      sortable: false,
      disableColumnMenu: true,
      renderCell: ({ row, tabIndex }) => (
        <RecordActions
          name={row.name}
          tabIndex={tabIndex}
          disabled={false}
          onView={() => {
            setViewed(row);
          }}
          onEdit={() => {
            edit(row);
          }}
          onDelete={() => {
            setDeleting([row.id]);
          }}
        />
      ),
    },
  ];
  return (
    <Stack direction="row" sx={{ minWidth: 0, alignItems: 'flex-start' }}>
      <Paper sx={{ p: { xs: 3, md: 5 }, minWidth: 0, flex: 1 }}>
        <ContentSection
          title="List, filters & row menus"
          description="Try sorting, pagination, page selection and the shared row menu. Changes affect these examples only."
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ gap: 2, alignItems: { sm: 'center' } }}
          >
            <StyledTextField
              label="Search examples"
              value={search}
              size="small"
              onChange={(event) => {
                setSearch(event.target.value);
                resetSelection();
              }}
              sx={{ flex: 1 }}
            />
            <Button
              variant="soft"
              color="neutral"
              startIcon={<IconifyIcon icon="material-symbols:filter-alt-outline" />}
              onClick={() => {
                setFiltersOpen(true);
              }}
            >
              Filters
            </Button>
            <Button
              variant="contained"
              startIcon={<IconifyIcon icon="material-symbols:add-rounded" />}
              onClick={() => {
                const row: ExampleRow = {
                  id: crypto.randomUUID(),
                  name: 'New example',
                  code: 'EX-NEW',
                  active: false,
                };
                edit(row);
              }}
            >
              Add example
            </Button>
          </Stack>
          {selection.ids.size > 0 && (
            <Stack
              direction="row"
              sx={{
                gap: 2,
                alignItems: 'center',
                p: 2,
                bgcolor: 'background.elevation1',
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                {selection.ids.size} selected on this page
              </Typography>
              <Button
                color="error"
                variant="soft"
                onClick={() => {
                  setDeleting(rows.filter((row) => selection.ids.has(row.id)).map((row) => row.id));
                }}
              >
                Delete selected
              </Button>
            </Stack>
          )}
          <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <DataGrid
              aria-label="Catalog examples"
              rows={pageRows}
              columns={columns}
              rowHeight={64}
              checkboxSelection
              disableRowSelectionExcludeModel
              disableRowSelectionOnClick
              disableColumnMenu
              disableColumnFilter
              columnVisibilityModel={{ code: !compact, active: !compact }}
              rowSelectionModel={selection}
              onRowSelectionModelChange={setSelection}
              paginationMode="server"
              sortingMode="server"
              sortModel={sort}
              rowCount={filtered.length}
              paginationModel={page}
              pageSizeOptions={[5, 10, 20]}
              onPaginationModelChange={(model) => {
                setPage(model);
                setSelection(emptySelection());
              }}
              onSortModelChange={(next) => {
                setSort(next);
                resetSelection();
              }}
              slots={{ basePagination: DataGridPagination }}
              localeText={{ noRowsLabel: 'No examples match these filters.' }}
            />
          </Box>
        </ContentSection>
      </Paper>
      <FilterDrawer
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
        }}
        label="Catalog filters"
      >
        <StyledTextField
          label="Filter by name"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetSelection();
          }}
        />
        <StyledTextField
          select
          label="Example status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            resetSelection();
          }}
        >
          <MenuItem value="all">All statuses</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
        </StyledTextField>
        <Button
          variant="soft"
          color="neutral"
          onClick={() => {
            setSearch('');
            setStatus('all');
            resetSelection();
          }}
        >
          Clear filters
        </Button>
      </FilterDrawer>
      <Dialog
        open={Boolean(editor)}
        onClose={() => {
          setEditor(null);
        }}
        aria-labelledby="catalog-edit-title"
        fullWidth
        maxWidth="sm"
      >
        <Box
          component="form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setAttempted(true);
            if (!editor || !editor.name.trim()) return;
            const savedRow = { ...editor, name: editor.name.trim() };
            setRows((current) =>
              current.some((row) => row.id === editor.id)
                ? current.map((row) => (row.id === editor.id ? savedRow : row))
                : [savedRow, ...current],
            );
            setSearch('');
            setStatus('all');
            resetSelection();
            setEditor(null);
            setNotice('Example saved on this page.');
          }}
        >
          <DialogTitle id="catalog-edit-title">Edit example</DialogTitle>
          <DialogContent>
            <TextField
              label="Example name"
              autoFocus
              fullWidth
              required
              value={editor?.name ?? ''}
              error={attempted && !editor?.name.trim()}
              helperText={
                attempted && !editor?.name.trim()
                  ? 'Enter a name.'
                  : 'This changes the catalog example only.'
              }
              sx={{ mt: 1 }}
              onChange={(event) => {
                setEditor((current) => (current ? { ...current, name: event.target.value } : null));
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              color="neutral"
              onClick={() => {
                setEditor(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="contained" type="submit">
              Save example
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog
        open={Boolean(viewed)}
        onClose={() => {
          setViewed(null);
        }}
        aria-labelledby="catalog-view-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="catalog-view-title">Example details</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2 }}>
            <Typography>{viewed?.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              Code: {viewed?.code}
            </Typography>
            <Chip
              sx={{ alignSelf: 'flex-start' }}
              label={viewed?.active ? 'Active' : 'Draft'}
              variant="soft"
              color={viewed?.active ? 'success' : 'neutral'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setViewed(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={deleting.length > 0}
        onClose={() => {
          setDeleting([]);
        }}
        aria-labelledby="catalog-delete-title"
      >
        <DialogTitle id="catalog-delete-title">Delete catalog examples?</DialogTitle>
        <DialogContent>
          <Typography>
            {deleting.length} example(s) will be removed from this page. Stored prototype data is
            unchanged.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            onClick={() => {
              setDeleting([]);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setRows((current) => current.filter((row) => !deleting.includes(row.id)));
              setDeleting([]);
              resetSelection();
              setNotice('Examples removed from this page.');
            }}
          >
            Delete examples
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={4000}
        onClose={() => {
          setNotice('');
        }}
      >
        <Alert
          severity="success"
          onClose={() => {
            setNotice('');
          }}
        >
          {notice}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
