import { useTranslation } from 'react-i18next';
import { useLocalizedNavigate, useLocalizedPath } from '../../i18n/routing.js';
// Aurora presentation shared by Reference supporting entities; forms and API mappings stay concrete.
import { useList } from '@refinedev/core';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Link,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  DataGrid,
  GRID_CHECKBOX_SELECTION_COL_DEF,
  type GridColDef,
  type GridRowSelectionModel,
  type GridSortModel,
} from '@mui/x-data-grid';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router';
import { PageHeader } from '../../components/page-header.js';
import type { DataError } from '../../data/data-provider.js';
import type { ReferenceVenueDetailsFragment } from '../../generated/graphql/operations.js';
import IconifyIcon from '../../layout/primitives/iconify-icon.js';
import StyledTextField from '../../layout/primitives/styled-text-field.js';
import { LookupFilters } from './lookup-filters.js';
import { useRecordDeletion } from '../use-record-deletion.js';
import { RecordActions } from '../../components/record-actions.js';

type LookupRow = Pick<ReferenceVenueDetailsFragment, 'id' | 'name' | 'active'>;

const emptySelection = (): GridRowSelectionModel => ({ type: 'include', ids: new Set() });
type ListQueryChanges = Partial<Record<'search' | 'status' | 'sort' | 'order', string>>;

export function LookupList<T extends LookupRow>({
  resource,
  entity,
  columns: detailColumns,
  onDeleted,
}: {
  resource: string;
  entity: 'venues' | 'speakers' | 'tags';
  columns: GridColDef<T>[];
  onDeleted: (count: number) => void;
}) {
  const { t } = useTranslation(['reference', 'common']);
  const title = t(`reference:${entity}.title`);
  const singular = entity.slice(0, -1);
  const navigate = useLocalizedNavigate();
  const localize = useLocalizedPath();
  const [params, setParams] = useSearchParams();
  const { key: locationKey } = useLocation();
  const page = Math.max(1, Math.min(21474836, Math.floor(Number(params.get('page'))) || 1));
  const requestedSize = Number(params.get('pageSize'));
  const pageSize = [10, 20, 50, 100].includes(requestedSize) ? requestedSize : 20;
  const status =
    params.get('status') === 'ACTIVE'
      ? 'ACTIVE'
      : params.get('status') === 'INACTIVE'
        ? 'INACTIVE'
        : 'all';
  const urlSearch = params.get('search') ?? '';
  const requestedSort = params.get('sort');
  const sortField =
    requestedSort &&
    (requestedSort === 'name' ||
      requestedSort === 'active' ||
      detailColumns.some((column) => column.field === requestedSort && column.sortable !== false))
      ? requestedSort
      : null;
  const sortDirection = params.get('order') === 'desc' ? 'desc' : 'asc';
  // A new model identity triggers the grid's page reset, even when sorting is unchanged.
  const sortModel = useMemo<GridSortModel>(
    () => (sortField ? [{ field: sortField, sort: sortDirection }] : []),
    [sortField, sortDirection],
  );
  const [search, setSearch] = useState(urlSearch);
  const textFilterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // URL synchronization and clearing fields must not schedule a new text search.
  const textFilterEdited = useRef(false);
  // Every navigation restores URL drafts, including Back with an unchanged search parameter.
  const [lastLocation, setLastLocation] = useState(locationKey);
  if (lastLocation !== locationKey) {
    setLastLocation(locationKey);
    setSearch(urlSearch);
  }
  const [filterOpen, setFilterOpen] = useState(false);
  const [selection, setSelection] = useState(emptySelection);
  const selectionScope = JSON.stringify([
    page,
    pageSize,
    status,
    urlSearch,
    sortField,
    sortDirection,
  ]);
  const [lastScope, setLastScope] = useState(selectionScope);
  if (lastScope !== selectionScope) {
    setLastScope(selectionScope);
    setSelection(emptySelection());
  }
  const records = useList<T, DataError>({
    resource,
    pagination: { currentPage: page, pageSize, mode: 'server' },
    sorters: sortField ? [{ field: sortField, order: sortDirection }] : [],
    filters: [
      { field: 'search', operator: 'contains', value: urlSearch },
      {
        field: 'active',
        operator: 'eq',
        value: status === 'all' ? undefined : status === 'ACTIVE',
      },
    ],
    errorNotification: false,
  });
  // MUI uses -1 for an unknown total; zero can reset a reloaded page before data arrives.
  const [knownTotal, setKnownTotal] = useState(-1);
  const total = records.result.total;
  if (records.query.isSuccess && total !== undefined && total !== knownTotal) setKnownTotal(total);
  const applyTextFilters = useEffectEvent(() => {
    if (textFilterEdited.current) changeListQuery({}, true);
  });
  useEffect(() => {
    if (!textFilterEdited.current || search === urlSearch) return;
    textFilterTimer.current = setTimeout(applyTextFilters, 300);
    return () => {
      clearTimeout(textFilterTimer.current);
    };
  }, [search, urlSearch, setParams]);

  function changeSearch(value: string) {
    textFilterEdited.current = true;
    setSearch(value);
  }
  // All filter/sort changes include the current text drafts and reset pagination together.
  function changeListQuery(changes: ListQueryChanges, replace = false) {
    textFilterEdited.current = false;
    clearTimeout(textFilterTimer.current);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries({
          search: search.trim(),
          page: '',
          ...changes,
        })) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace, flushSync: true },
    );
  }
  function setStatus(value: string) {
    changeListQuery({ status: value === 'all' ? '' : value });
  }
  function clearFilters() {
    setSearch('');
    changeListQuery({ search: '', status: '' });
  }
  function setSorting(model: GridSortModel) {
    if (deleting) return;
    const item = model[0];
    changeListQuery({ sort: item?.sort ? item.field : '', order: item?.sort ?? '' });
  }
  const {
    targets,
    failures,
    pending: deleting,
    confirm: confirmDelete,
    cancel,
    remove,
  } = useRecordDeletion(resource, (deleted, failedIds) => {
    setSelection({ type: 'include', ids: new Set(failedIds) });
    const lastPage = Math.max(1, Math.ceil(((records.result.total ?? 0) - deleted) / pageSize));
    if (page > lastPage)
      setParams(
        (current) => {
          const result = new URLSearchParams(current);
          result.set('page', String(lastPage));
          return result;
        },
        { replace: true },
      );
    if (deleted) onDeleted(deleted);
  });
  const columns = useMemo<GridColDef<T>[]>(
    () => [
      { ...GRID_CHECKBOX_SELECTION_COL_DEF, width: 64 },
      {
        field: 'name',
        headerName: t('reference:fields.name'),
        flex: 2,
        minWidth: 210,
        renderCell: ({ row, tabIndex }) => (
          <Link
            component={RouterLink}
            to={localize(`/${resource}/${row.id}/edit`)}
            tabIndex={tabIndex}
            variant="subtitle2"
            sx={{ color: 'text.primary', fontWeight: 400 }}
          >
            {row.name}
          </Link>
        ),
      },
      ...detailColumns,
      {
        field: 'active',
        headerName: t('common:status.label'),
        flex: 1,
        minWidth: 120,
        renderCell: ({ row }) => (
          <Chip
            label={row.active ? t('common:status.active') : t('common:status.inactive')}
            color={row.active ? 'success' : 'neutral'}
          />
        ),
      },
      {
        field: 'action',
        sortable: false,
        headerName: '',
        width: 64,
        align: 'right',
        renderCell: ({ row, tabIndex }) => (
          <RecordActions
            name={row.name}
            tabIndex={tabIndex}
            disabled={deleting}
            onEdit={() => {
              void navigate(`/${resource}/${row.id}/edit`);
            }}
            onDelete={() => {
              confirmDelete([row]);
            }}
          />
        ),
      },
    ],
    [resource, detailColumns, deleting, navigate, localize, confirmDelete, t],
  );
  const rows = records.query.isError ? [] : records.result.data;
  const selectedRows = rows.filter((row) => selection.ids.has(row.id));
  const hasFilters = Boolean(urlSearch || status !== 'all');
  return (
    <Stack direction="row" sx={{ flex: 1, minWidth: 0 }}>
      <LookupFilters
        entity={entity}
        open={filterOpen}
        onClose={() => {
          setFilterOpen(false);
        }}
        search={search}
        status={status}
        disabled={deleting}
        onSearchChange={changeSearch}
        onStatusChange={setStatus}
        onClear={clearFilters}
      />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <PageHeader
          title={title}
          breadcrumbs={[
            { label: t('common:home'), to: '/' },
            { label: t('reference:label') },
            { label: title },
          ]}
          action={
            <Button
              variant="contained"
              startIcon={<IconifyIcon icon="material-symbols:add-rounded" />}
              onClick={() => {
                void navigate(`/${resource}/create`);
              }}
            >
              {t(`reference:${entity}.actions.create`)}
            </Button>
          }
        />
        <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1, minWidth: 0 }}>
          <Stack
            direction={{ md: 'row' }}
            sx={{ gap: 2, mb: 4, justifyContent: 'space-between', alignItems: { md: 'center' } }}
          >
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <StyledTextField
                id={`${singular}-search`}
                type="search"
                placeholder={t(`reference:${entity}.filters.search`)}
                value={search}
                disabled={deleting}
                onChange={(event) => {
                  changeSearch(event.target.value);
                }}
                slotProps={{
                  htmlInput: {
                    'aria-label': t(`reference:${entity}.filters.search`),
                    maxLength: 200,
                  },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <IconifyIcon icon="material-symbols:search-rounded" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ width: { xs: '100%', md: 255 } }}
              />
              <Button
                variant="soft"
                color="neutral"
                aria-label={t(`reference:${entity}.filters.open`)}
                aria-expanded={filterOpen}
                onClick={() => {
                  setFilterOpen(!filterOpen);
                }}
                sx={{ flexShrink: 0, gap: 0.5 }}
              >
                <IconifyIcon icon="material-symbols:filter-alt-outline" sx={{ fontSize: 20 }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {t('common:actions.filter')}
                </Box>
              </Button>
            </Stack>
            <Tabs
              value={status}
              aria-label={t(`reference:${entity}.filters.status`)}
              onChange={(_, value: unknown) => {
                if (typeof value === 'string') setStatus(value);
              }}
            >
              <Tab label={t(`reference:${entity}.filters.all`)} value="all" disabled={deleting} />
              <Tab label={t('common:status.active')} value="ACTIVE" disabled={deleting} />
              <Tab label={t('common:status.inactive')} value="INACTIVE" disabled={deleting} />
            </Tabs>
          </Stack>
          {status !== 'all' && (
            <Stack direction="row" sx={{ gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Chip
                label={t('common:status.chip', {
                  status:
                    status === 'ACTIVE' ? t('common:status.active') : t('common:status.inactive'),
                })}
                disabled={deleting}
                onDelete={() => {
                  setStatus('all');
                }}
              />
            </Stack>
          )}
          {records.query.isError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={
                <Button
                  onClick={() => {
                    void records.query.refetch();
                  }}
                >
                  {t('common:actions.retry')}
                </Button>
              }
            >
              {records.query.error.message}
            </Alert>
          )}
          {selectedRows.length > 0 && (
            <Stack
              direction="row"
              sx={{
                mb: 2,
                p: 1.5,
                bgcolor: 'background.elevation1',
                borderRadius: 2,
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                {t('common:selected', { count: selectedRows.length })}
              </Typography>
              <Button
                color="error"
                variant="soft"
                disabled={deleting}
                onClick={() => {
                  confirmDelete(selectedRows);
                }}
              >
                {t('common:actions.deleteSelected')}
              </Button>
            </Stack>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <DataGrid
              aria-label={title}
              rows={rows}
              columns={columns}
              rowHeight={64}
              checkboxSelection
              disableRowSelectionExcludeModel
              disableColumnSorting={deleting}
              disableColumnFilter
              rowSelectionModel={selection}
              onRowSelectionModelChange={setSelection}
              isRowSelectable={() => !deleting}
              loading={records.query.isFetching}
              paginationMode="server"
              filterMode="server"
              sortingMode="server"
              sortModel={sortModel}
              onSortModelChange={setSorting}
              rowCount={knownTotal}
              paginationModel={{ page: page - 1, pageSize }}
              pageSizeOptions={[10, 20, 50, 100]}
              onPaginationModelChange={(model) => {
                if (deleting) return;
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set('page', String(model.pageSize === pageSize ? model.page + 1 : 1));
                  next.set('pageSize', String(model.pageSize));
                  return next;
                });
              }}
              localeText={{
                noRowsLabel: records.query.isError
                  ? t(`reference:${entity}.list.unavailable`)
                  : hasFilters
                    ? t(`reference:${entity}.list.noMatches`)
                    : t(`reference:${entity}.list.empty`),
              }}
              onCellClick={(cell, event) => {
                if (
                  cell.field === '__check__' ||
                  cell.field === 'action' ||
                  (event.target instanceof Element && event.target.closest('a, button, input'))
                )
                  return;
                void navigate(`/${resource}/${String(cell.id)}/edit`);
              }}
              sx={{
                '& .MuiDataGrid-row': { cursor: 'pointer' },
              }}
            />
          </Box>
        </Paper>
      </Stack>

      <Dialog
        open={targets.length > 0}
        onClose={cancel}
        aria-labelledby={`delete-${entity}-title`}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id={`delete-${entity}-title`}>
          {t(`reference:${entity}.delete.title`, { count: targets.length })}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t(`reference:${entity}.delete.description`, {
              count: targets.length,
              name: targets[0]?.name,
            })}{' '}
            {t(`reference:${entity}.delete.hint`)}
          </Typography>
          {failures.length > 0 && (
            <Alert severity="error">
              {t('reference:lookups.failedDelete', { count: failures.length })}
              {failures.map((failure) => (
                <Typography key={failure.id} variant="body2">
                  {failure.name}: {failure.message}
                </Typography>
              ))}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="neutral" disabled={deleting} onClick={cancel}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="contained" color="error" loading={deleting} onClick={remove}>
            {t(`reference:${entity}.actions.delete`, { count: targets.length })}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
