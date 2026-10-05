import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['prototype', 'common', 'reference', 'validation']);
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
      headerName: t('reference:fields.name'),
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
              label={row.active ? t('common:status.active') : t('reference:events.status.DRAFT')}
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
        </Stack>
      ),
    },
    { field: 'code', headerName: t('reference:fields.code'), width: 140 },
    {
      field: 'active',
      headerName: t('common:status.label'),
      width: 120,
      renderCell: ({ row }) => (
        <Chip
          variant="soft"
          color={row.active ? 'success' : 'neutral'}
          label={row.active ? t('common:status.active') : t('reference:events.status.DRAFT')}
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
          title={t('prototype:catalog.lists.title')}
          description={t('prototype:catalog.lists.description')}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ gap: 2, alignItems: { sm: 'center' } }}
          >
            <StyledTextField
              label={t('prototype:catalog.lists.search')}
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
              {t('prototype:catalog.lists.filters')}
            </Button>
            <Button
              variant="contained"
              startIcon={<IconifyIcon icon="material-symbols:add-rounded" />}
              onClick={() => {
                const row: ExampleRow = {
                  id: crypto.randomUUID(),
                  name: t('prototype:catalog.lists.new'),
                  code: 'EX-NEW',
                  active: false,
                };
                edit(row);
              }}
            >
              {t('prototype:catalog.lists.add')}
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
                {t('common:selected', { count: selection.ids.size })}
              </Typography>
              <Button
                color="error"
                variant="soft"
                onClick={() => {
                  setDeleting(rows.filter((row) => selection.ids.has(row.id)).map((row) => row.id));
                }}
              >
                {t('common:actions.deleteSelected')}
              </Button>
            </Stack>
          )}
          <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <DataGrid
              aria-label={t('prototype:catalog.lists.label')}
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
              localeText={{ noRowsLabel: t('prototype:catalog.lists.noMatches') }}
            />
          </Box>
        </ContentSection>
      </Paper>
      <FilterDrawer
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
        }}
        label={t('prototype:catalog.lists.filterLabel')}
      >
        <StyledTextField
          label={t('prototype:catalog.lists.filterName')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetSelection();
          }}
        />
        <StyledTextField
          select
          label={t('prototype:catalog.lists.status')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            resetSelection();
          }}
        >
          <MenuItem value="all">{t('common:status.all')}</MenuItem>
          <MenuItem value="active">{t('common:status.active')}</MenuItem>
          <MenuItem value="draft">{t('reference:events.status.DRAFT')}</MenuItem>
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
          {t('common:actions.clearFilters')}
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
            setNotice(t('prototype:catalog.lists.saved'));
          }}
        >
          <DialogTitle id="catalog-edit-title">{t('prototype:catalog.lists.edit')}</DialogTitle>
          <DialogContent>
            <TextField
              label={t('prototype:catalog.lists.name')}
              autoFocus
              fullWidth
              required
              value={editor?.name ?? ''}
              error={attempted && !editor?.name.trim()}
              helperText={
                attempted && !editor?.name.trim()
                  ? t('validation:catalog.name')
                  : t('prototype:catalog.lists.editHint')
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
              {t('common:actions.cancel')}
            </Button>
            <Button variant="contained" type="submit">
              {t('prototype:catalog.forms.save')}
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
        <DialogTitle id="catalog-view-title">{t('prototype:catalog.lists.details')}</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2 }}>
            <Typography>{viewed?.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('prototype:catalog.lists.codeSummary', { code: viewed?.code })}
            </Typography>
            <Chip
              sx={{ alignSelf: 'flex-start' }}
              label={
                viewed?.active ? t('common:status.active') : t('reference:events.status.DRAFT')
              }
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
            {t('common:actions.close')}
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
        <DialogTitle id="catalog-delete-title">
          {t('prototype:catalog.lists.deleteTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t('prototype:catalog.lists.deleteDescription', { count: deleting.length })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            onClick={() => {
              setDeleting([]);
            }}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setRows((current) => current.filter((row) => !deleting.includes(row.id)));
              setDeleting([]);
              resetSelection();
              setNotice(t('prototype:catalog.lists.deleted'));
            }}
          >
            {t('prototype:catalog.lists.delete')}
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
