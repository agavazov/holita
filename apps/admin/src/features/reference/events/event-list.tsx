import { useDelete, useList } from '@refinedev/core';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  Paper,
  Popover,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  DataGrid,
  GRID_CHECKBOX_SELECTION_COL_DEF,
  type GridColDef,
  type GridCellParams,
  type GridSortModel,
} from '@mui/x-data-grid';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PageHeader } from '../../../components/page-header.js';
import { RecordActions } from '../../../components/record-actions.js';
import IconifyIcon from '../../../layout/primitives/iconify-icon.js';
import StyledTextField from '../../../layout/primitives/styled-text-field.js';
import { eventsResource, type DataError } from '../../../data/data-provider.js';
import type {
  DeleteReferenceEventMutation,
  ReferenceEventListItemFragment,
} from '../../../generated/graphql/operations.js';
import { EventBulkActions } from './event-bulk-actions.js';
import { useEventActions } from './use-event-actions.js';
import { EventFilters } from './event-filters.js';
import {
  defaultEventColumns,
  eventColumnChoices,
  eventColumns,
  readEventColumns,
} from './event-columns.js';
import {
  eventLink,
  eventListFilters,
  eventListSearch,
  isEventSortField,
  readEventList,
  type EventListState,
} from './event-list-state.js';

export function EventList({
  storeId,
  storeName,
  onDeleted,
}: {
  storeId: string;
  storeName: string;
  onDeleted: () => void;
}) {
  const resource = eventsResource(storeId);
  const navigate = useNavigate();
  const { search, key: locationKey } = useLocation();
  const state = useMemo(() => readEventList(search), [search]);
  const latestState = useRef(state);
  useEffect(() => {
    latestState.current = state;
  }, [state]);
  const filters = eventListFilters(state);
  const filterCount = filters.filter(
    (filter) => 'field' in filter && filter.field !== 'trashed',
  ).length;
  const [selection, setSelection] = useState<{ search: string; ids: string[] }>({
    search,
    ids: [],
  });
  if (selection.search !== search) setSelection({ search, ids: [] });
  const [notice, setNotice] = useState('');
  const actions = useEventActions();
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterReset, setFilterReset] = useState(0);
  const [columnAnchor, setColumnAnchor] = useState<HTMLElement | null>(null);
  const [text, setText] = useState(state.search);
  const [lastLocation, setLastLocation] = useState(locationKey);
  if (lastLocation !== locationKey) {
    setLastLocation(locationKey);
    setText(state.search);
  }
  const textEdited = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function change(patch: Partial<EventListState>) {
    textEdited.current = false;
    clearTimeout(timer.current);
    // Merge consecutive controls before their router update has rendered.
    const next = { ...latestState.current, search: text.trim(), page: 1, ...patch };
    latestState.current = next;
    void navigate(`/${resource}${eventListSearch(next)}`);
  }
  const applyText = useEffectEvent(() => {
    if (textEdited.current) change({});
  });
  useEffect(() => {
    if (!textEdited.current || text === state.search) return;
    timer.current = setTimeout(applyText, 300);
    return () => {
      clearTimeout(timer.current);
    };
  }, [text, state.search]);
  function changeSearch(value: string) {
    textEdited.current = true;
    setText(value);
  }
  const sortModel = useMemo<GridSortModel>(
    () => [{ field: state.sort, sort: state.order }],
    [state.sort, state.order],
  );
  const columnsKey = `holita:${resource}:columns`;
  const [visible, setVisible] = useState(() => readEventColumns(columnsKey));
  const [selected, setSelected] = useState<ReferenceEventListItemFragment>();
  const events = useList<ReferenceEventListItemFragment, DataError>({
    resource,
    pagination: { currentPage: state.page, pageSize: state.size, mode: 'server' },
    filters,
    sorters: [{ field: state.sort, order: state.order }],
    errorNotification: false,
  });
  const selectedIds =
    selection.search === search
      ? selection.ids.filter((id) => events.result.data.some((row) => row.id === id))
      : [];
  const deletion = useDelete<DeleteReferenceEventMutation['deleteReferenceEvent'], DataError>();
  const submitting = useRef(false);
  function clearFilters() {
    setText('');
    setFilterReset((value) => value + 1);
    change({
      ...readEventList(''),
      sort: state.sort,
      order: state.order,
      size: state.size,
      trashed: state.trashed,
    });
  }
  const lastPage = Math.max(1, Math.ceil((events.result.total ?? 0) / state.size));
  useEffect(() => {
    if (events.query.isSuccess && !events.query.isFetching && state.page > lastPage)
      void navigate(
        `/${resource}${eventListSearch({ ...readEventList(search), page: lastPage })}`,
        { replace: true },
      );
  }, [
    events.query.isSuccess,
    events.query.isFetching,
    state.page,
    lastPage,
    resource,
    search,
    navigate,
  ]);
  function saveColumns(values: string[]) {
    setVisible(values);
    try {
      localStorage.setItem(columnsKey, JSON.stringify(values));
    } catch {
      /* Keep the view usable when browser storage is blocked. */
    }
  }
  function restore(row: ReferenceEventListItemFragment) {
    if (submitting.current) return;
    submitting.current = true;
    actions.mutate(
      {
        url: resource,
        method: 'post',
        values: { action: 'restore', ids: [row.id] },
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setNotice('Event restored.');
          setSelection({ search, ids: [] });
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  function remove() {
    if (!selected || submitting.current) return;
    submitting.current = true;
    deletion.mutate(
      {
        resource,
        id: selected.id,
        mutationMode: 'pessimistic',
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setSelected(undefined);
          onDeleted();
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  const [knownTotal, setKnownTotal] = useState(-1);
  if (
    events.query.isSuccess &&
    events.result.total !== undefined &&
    events.result.total !== knownTotal
  )
    setKnownTotal(events.result.total);
  const pending = deletion.mutation.isPending || actions.mutation.isPending;
  const columns: GridColDef<ReferenceEventListItemFragment>[] = [
    { ...GRID_CHECKBOX_SELECTION_COL_DEF, width: 64 },
    ...eventColumns(resource, search),
    {
      field: 'action',
      headerName: '',
      width: 64,
      sortable: false,
      align: 'right',
      renderCell: ({ row, tabIndex }) => (
        <RecordActions
          name={row.title}
          tabIndex={tabIndex}
          disabled={pending}
          onView={() => {
            void navigate(eventLink(resource, row.id, search));
          }}
          editLabel={row.deletedAt ? 'Restore' : 'Edit'}
          onEdit={() => {
            if (row.deletedAt) restore(row);
            else void navigate(eventLink(resource, `${row.id}/edit`, search));
          }}
          {...(!row.deletedAt
            ? {
                onDelete: () => {
                  deletion.mutation.reset();
                  setSelected(row);
                },
              }
            : {})}
          deleteLabel="Move to trash"
        />
      ),
    },
  ];
  return (
    <Stack direction="row" sx={{ flex: 1, minWidth: 0 }}>
      <EventFilters
        key={filterReset}
        storeId={storeId}
        state={state}
        locationKey={locationKey}
        search={text}
        open={filterOpen}
        onClose={() => {
          setFilterOpen(false);
        }}
        onSearchChange={changeSearch}
        onChange={change}
        onClear={clearFilters}
      />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <PageHeader
          title="Events"
          breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Reference' }, { label: 'Events' }]}
          action={
            <Button
              variant="contained"
              startIcon={<IconifyIcon icon="material-symbols:add-rounded" />}
              onClick={() => {
                void navigate(eventLink(resource, 'create', search));
              }}
            >
              Create event
            </Button>
          }
        />
        <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1, minWidth: 0 }}>
          <Stack
            direction={{ md: 'row' }}
            sx={{ gap: 2, mb: 3, justifyContent: 'space-between', alignItems: { md: 'center' } }}
          >
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <StyledTextField
                type="search"
                placeholder="Search title or code"
                value={text}
                onChange={(event) => {
                  changeSearch(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') change({});
                }}
                slotProps={{
                  htmlInput: { 'aria-label': 'Search events', maxLength: 200 },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <IconifyIcon icon="material-symbols:search-rounded" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ width: { xs: '100%', sm: 255 } }}
              />
              <Button
                variant="soft"
                color="neutral"
                aria-label="Filter events"
                aria-expanded={filterOpen}
                onClick={() => {
                  setFilterOpen(!filterOpen);
                }}
                sx={{ gap: 0.5 }}
              >
                <IconifyIcon icon="material-symbols:filter-alt-outline" sx={{ fontSize: 20 }} />
                Filter{filterCount ? ` (${String(filterCount)})` : ''}
              </Button>
              <Button
                variant="soft"
                color="neutral"
                onClick={(event) => {
                  setColumnAnchor(event.currentTarget);
                }}
                aria-haspopup="dialog"
                aria-expanded={Boolean(columnAnchor)}
              >
                Columns
              </Button>
              {filterCount > 0 && (
                <Button color="neutral" onClick={clearFilters}>
                  Reset filters
                </Button>
              )}
            </Stack>
            <Tabs
              value={state.trashed ? 'trash' : 'active'}
              aria-label="Event view"
              onChange={(_, value: string) => {
                change({ trashed: value === 'trash' });
              }}
            >
              <Tab value="active" label="Active" />
              <Tab value="trash" label="Trash" />
            </Tabs>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {storeName} · All times in Europe/Sofia
          </Typography>
          {notice && (
            <Alert
              severity="success"
              role="status"
              sx={{ mb: 2 }}
              onClose={() => {
                setNotice('');
              }}
            >
              {notice}
            </Alert>
          )}
          {actions.mutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {actions.mutation.error.message}
            </Alert>
          )}
          {events.query.isError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={
                <Button
                  onClick={() => {
                    void events.query.refetch();
                  }}
                >
                  Retry
                </Button>
              }
            >
              {events.query.error.message}
            </Alert>
          )}
          <EventBulkActions
            key={`${resource}${search}`}
            resource={resource}
            ids={selectedIds}
            trashed={state.trashed}
            onComplete={(message) => {
              setSelection({ search, ids: [] });
              setNotice(message);
            }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <DataGrid<ReferenceEventListItemFragment>
              aria-label="Events"
              rows={events.query.isError ? [] : events.result.data}
              columns={columns}
              rowHeight={64}
              columnVisibilityModel={Object.fromEntries(
                eventColumnChoices.map(({ value }) => [value, visible.includes(value)]),
              )}
              checkboxSelection
              disableRowSelectionExcludeModel
              disableColumnFilter
              disableColumnSorting={pending}
              rowSelectionModel={{ type: 'include', ids: new Set(selectedIds) }}
              onRowSelectionModelChange={(model) => {
                setSelection({ search, ids: [...model.ids].map(String) });
              }}
              isRowSelectable={() => !pending}
              loading={events.query.isFetching}
              paginationMode="server"
              filterMode="server"
              sortingMode="server"
              sortModel={sortModel}
              onSortModelChange={(model) => {
                const item = model[0];
                change({
                  sort: item?.sort && isEventSortField(item.field) ? item.field : 'startsAt',
                  order: item?.sort === 'desc' ? 'desc' : 'asc',
                });
              }}
              rowCount={knownTotal}
              paginationModel={{ page: state.page - 1, pageSize: state.size }}
              pageSizeOptions={[10, 20, 50, 100]}
              onPaginationModelChange={(model) => {
                change({
                  page: model.pageSize === state.size ? model.page + 1 : 1,
                  size: model.pageSize,
                });
              }}
              localeText={{
                noRowsLabel: events.query.isError
                  ? 'Events unavailable'
                  : filterCount
                    ? 'No events match these filters.'
                    : state.trashed
                      ? 'Trash is empty.'
                      : 'No events in this store yet.',
              }}
              onCellClick={(
                { field, row }: GridCellParams<ReferenceEventListItemFragment>,
                event,
              ) => {
                if (
                  field === '__check__' ||
                  field === 'action' ||
                  (event.target instanceof Element && event.target.closest('a, button, input'))
                )
                  return;
                void navigate(
                  eventLink(resource, `${row.id}${row.deletedAt ? '' : '/edit'}`, search),
                );
              }}
              sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            />
          </Box>
        </Paper>
      </Stack>
      <Popover
        open={Boolean(columnAnchor)}
        anchorEl={columnAnchor}
        onClose={() => {
          setColumnAnchor(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Stack role="dialog" aria-label="Visible columns" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Visible columns
          </Typography>
          {eventColumnChoices.map(({ value, label }) => (
            <FormControlLabel
              key={value}
              label={label}
              control={
                <Checkbox
                  checked={visible.includes(value)}
                  onChange={(_, checked) => {
                    saveColumns(
                      checked ? [...visible, value] : visible.filter((field) => field !== value),
                    );
                  }}
                />
              }
            />
          ))}
          <Button
            onClick={() => {
              saveColumns(defaultEventColumns);
            }}
          >
            Reset columns
          </Button>
        </Stack>
      </Popover>
      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          if (!submitting.current) setSelected(undefined);
        }}
        fullWidth
        maxWidth="xs"
        aria-labelledby="event-trash-title"
      >
        <DialogTitle id="event-trash-title">Move event to trash?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {selected?.title} will be removed from the active list.
          </Typography>
          {deletion.mutation.isError && (
            <Alert severity="error">{deletion.mutation.error.message}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            disabled={pending}
            onClick={() => {
              setSelected(undefined);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            loading={deletion.mutation.isPending}
            onClick={remove}
          >
            Move to trash
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
