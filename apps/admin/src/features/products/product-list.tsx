// Aurora Member list, Invoice header and search; real store-scoped Products data.
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
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '../../components/page-header.js';
import { productsResource, type DataError } from '../../data/data-provider.js';
import type { ProductDetailsFragment } from '../../generated/graphql/operations.js';
import IconifyIcon from '../../layout/primitives/iconify-icon.js';
import StyledTextField from '../../layout/primitives/styled-text-field.js';
import { ProductFilters } from './product-filters.js';
import { useRecordDeletion } from '../use-record-deletion.js';
import { RecordActions } from '../../components/record-actions.js';
import { localizedPath } from '../../localization/locale.js';
import { useLocalization } from '../../localization/localization-provider.js';

const emptySelection = (): GridRowSelectionModel => ({ type: 'include', ids: new Set() });
type ListQueryChanges = Partial<Record<'search' | 'sku' | 'status' | 'sort' | 'order', string>>;

export function ProductList({
  storeId,
  onDeleted,
}: {
  storeId: string;
  onDeleted: (count: number) => void;
}) {
  const resource = productsResource(storeId);
  const { locale, t } = useLocalization();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { key: locationKey } = useLocation();
  const page = Math.max(1, Math.min(21474836, Math.floor(Number(params.get('page'))) || 1));
  const requestedSize = Number(params.get('pageSize'));
  const pageSize = [10, 20, 50, 100].includes(requestedSize) ? requestedSize : 20;
  const status =
    params.get('status') === 'ACTIVE'
      ? 'ACTIVE'
      : params.get('status') === 'DRAFT'
        ? 'DRAFT'
        : 'all';
  const urlSearch = params.get('search') ?? '';
  const urlSku = params.get('sku') ?? '';
  const requestedSort = params.get('sort');
  const sortField =
    requestedSort === 'name' || requestedSort === 'sku' || requestedSort === 'status'
      ? requestedSort
      : null;
  const sortDirection = params.get('order') === 'desc' ? 'desc' : 'asc';
  // A new model identity triggers the grid's page reset, even when sorting is unchanged.
  const sortModel = useMemo<GridSortModel>(
    () => (sortField ? [{ field: sortField, sort: sortDirection }] : []),
    [sortField, sortDirection],
  );
  const [search, setSearch] = useState(urlSearch);
  const [sku, setSku] = useState(urlSku);
  const textFilterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // URL synchronization and clearing fields must not schedule a new text search.
  const textFilterEdited = useRef(false);
  // Every navigation restores URL drafts, including Back with an unchanged search parameter.
  const [lastLocation, setLastLocation] = useState(locationKey);
  if (lastLocation !== locationKey) {
    setLastLocation(locationKey);
    setSearch(urlSearch);
    setSku(urlSku);
  }
  const [filterOpen, setFilterOpen] = useState(false);
  const [selection, setSelection] = useState(emptySelection);
  const selectionScope = JSON.stringify([
    page,
    pageSize,
    status,
    urlSearch,
    urlSku,
    sortField,
    sortDirection,
  ]);
  const [lastScope, setLastScope] = useState(selectionScope);
  if (lastScope !== selectionScope) {
    setLastScope(selectionScope);
    setSelection(emptySelection());
  }
  const products = useList<ProductDetailsFragment, DataError>({
    resource,
    pagination: { currentPage: page, pageSize, mode: 'server' },
    sorters: sortField ? [{ field: sortField, order: sortDirection }] : [],
    filters: [
      { field: 'search', operator: 'contains', value: urlSearch },
      { field: 'sku', operator: 'contains', value: urlSku },
      { field: 'status', operator: 'eq', value: status },
    ],
    errorNotification: false,
  });
  // MUI uses -1 for an unknown total; zero can reset a reloaded page before data arrives.
  const [knownTotal, setKnownTotal] = useState(-1);
  const total = products.result.total;
  if (products.query.isSuccess && total !== undefined && total !== knownTotal) setKnownTotal(total);
  const applyTextFilters = useEffectEvent(() => {
    if (textFilterEdited.current) changeListQuery({}, true);
  });
  useEffect(() => {
    if (!textFilterEdited.current || (search === urlSearch && sku === urlSku)) return;
    textFilterTimer.current = setTimeout(applyTextFilters, 300);
    return () => {
      clearTimeout(textFilterTimer.current);
    };
  }, [search, sku, urlSearch, urlSku, setParams]);

  function changeSearch(value: string) {
    textFilterEdited.current = true;
    setSearch(value);
  }
  function changeSku(value: string) {
    textFilterEdited.current = true;
    setSku(value);
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
          sku: sku.trim(),
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
    setSku('');
    changeListQuery({ search: '', sku: '', status: '' });
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
    const lastPage = Math.max(1, Math.ceil(((products.result.total ?? 0) - deleted) / pageSize));
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
  const columns = useMemo<GridColDef<ProductDetailsFragment>[]>(
    () => [
      { ...GRID_CHECKBOX_SELECTION_COL_DEF, width: 64 },
      {
        field: 'name',
        headerName: t('products.name'),
        flex: 2,
        minWidth: 210,
        renderCell: ({ row, tabIndex }) => (
          <Link
            component={RouterLink}
            to={localizedPath(locale, `/${resource}/${row.id}/edit`)}
            tabIndex={tabIndex}
            variant="subtitle2"
            sx={{ color: 'text.primary', fontWeight: 400 }}
          >
            {row.name}
          </Link>
        ),
      },
      { field: 'sku', headerName: t('products.sku'), flex: 1.4, minWidth: 155 },
      {
        field: 'status',
        headerName: t('products.status'),
        flex: 1,
        minWidth: 120,
        renderCell: ({ row }) => (
          <Chip
            label={row.status === 'ACTIVE' ? t('products.active') : t('products.draft')}
            color={row.status === 'ACTIVE' ? 'success' : 'neutral'}
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
              void navigate(localizedPath(locale, `/${resource}/${row.id}/edit`));
            }}
            editLabel={t('common.edit')}
            deleteLabel={t('common.delete')}
            actionsLabel={t('common.actionsFor', { name: row.name })}
            onDelete={() => {
              confirmDelete([row]);
            }}
          />
        ),
      },
    ],
    [resource, deleting, navigate, confirmDelete, locale, t],
  );
  const rows = products.query.isError ? [] : products.result.data;
  const selectedRows = rows.filter((row) => selection.ids.has(row.id));
  const hasFilters = Boolean(urlSearch || urlSku || status !== 'all');
  return (
    <Stack direction="row" sx={{ flex: 1, minWidth: 0 }}>
      <ProductFilters
        open={filterOpen}
        onClose={() => {
          setFilterOpen(false);
        }}
        search={search}
        status={status}
        sku={sku}
        disabled={deleting}
        onSearchChange={changeSearch}
        onStatusChange={setStatus}
        onSkuChange={changeSku}
        onClear={clearFilters}
      />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <PageHeader
          title={t('products.title')}
          breadcrumbs={[
            { label: t('common.home'), to: localizedPath(locale, '/') },
            { label: t('products.title') },
          ]}
          action={
            <Button
              variant="contained"
              startIcon={<IconifyIcon icon="material-symbols:add-rounded" />}
              onClick={() => {
                void navigate(localizedPath(locale, `/${resource}/create`));
              }}
            >
              {t('products.create')}
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
                id="product-search"
                type="search"
                placeholder={t('products.search')}
                value={search}
                disabled={deleting}
                onChange={(event) => {
                  changeSearch(event.target.value);
                }}
                slotProps={{
                  htmlInput: { 'aria-label': t('products.search'), maxLength: 200 },
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
                aria-label={t('products.filters')}
                aria-expanded={filterOpen}
                onClick={() => {
                  setFilterOpen(!filterOpen);
                }}
                sx={{ flexShrink: 0, gap: 0.5 }}
              >
                <IconifyIcon icon="material-symbols:filter-alt-outline" sx={{ fontSize: 20 }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {t('common.filter')}
                </Box>
              </Button>
            </Stack>
            <Tabs
              value={status}
              aria-label={t('products.status')}
              onChange={(_, value: unknown) => {
                if (typeof value === 'string') setStatus(value);
              }}
            >
              <Tab label={t('products.all')} value="all" disabled={deleting} />
              <Tab label={t('products.active')} value="ACTIVE" disabled={deleting} />
              <Tab label={t('products.draft')} value="DRAFT" disabled={deleting} />
            </Tabs>
          </Stack>
          {(urlSku || status !== 'all') && (
            <Stack direction="row" sx={{ gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {status !== 'all' && (
                <Chip
                  label={t('products.statusFilter', {
                    status: status === 'ACTIVE' ? t('products.active') : t('products.draft'),
                  })}
                  disabled={deleting}
                  onDelete={() => {
                    setStatus('all');
                  }}
                />
              )}
              {urlSku && (
                <Chip
                  label={`SKU: ${urlSku}`}
                  disabled={deleting}
                  onDelete={() => {
                    changeSku('');
                  }}
                />
              )}
            </Stack>
          )}
          {products.query.isError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={
                <Button
                  onClick={() => {
                    void products.query.refetch();
                  }}
                >
                  {t('common.retry')}
                </Button>
              }
            >
              {t('common.genericError')}
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
                {t('products.selected', { count: selectedRows.length })}
              </Typography>
              <Button
                color="error"
                variant="soft"
                disabled={deleting}
                onClick={() => {
                  confirmDelete(selectedRows);
                }}
              >
                {t('products.deleteSelected')}
              </Button>
            </Stack>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <DataGrid
              aria-label={t('products.title')}
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
              loading={products.query.isFetching}
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
                noRowsLabel: products.query.isError
                  ? t('products.unavailable')
                  : hasFilters
                    ? t('products.noMatches')
                    : t('products.empty'),
              }}
              onCellClick={(cell, event) => {
                if (
                  cell.field === '__check__' ||
                  cell.field === 'action' ||
                  (event.target instanceof Element && event.target.closest('a, button, input'))
                )
                  return;
                void navigate(localizedPath(locale, `/${resource}/${String(cell.id)}/edit`));
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
        aria-labelledby="delete-products-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="delete-products-title">
          {targets.length === 1
            ? t('products.deleteOneTitle')
            : t('products.deleteManyTitle', { count: targets.length })}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {targets.length === 1
              ? t('products.deleteOneMessage', { name: targets[0]?.name ?? '' })
              : t('products.deleteManyMessage', { count: targets.length })}
          </Typography>
          {failures.length > 0 && (
            <Alert severity="error">
              {t('products.deleteFailures', { count: failures.length })}
              {failures.map((failure) => (
                <Typography key={failure.id} variant="body2">
                  {failure.name}: {t('common.genericError')}
                </Typography>
              ))}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="neutral" disabled={deleting} onClick={cancel}>
            {t('products.cancel')}
          </Button>
          <Button variant="contained" color="error" loading={deleting} onClick={remove}>
            {targets.length === 1 ? t('products.deleteOne') : t('products.deleteMany')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
