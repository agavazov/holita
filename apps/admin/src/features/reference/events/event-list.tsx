import { useDelete, useList } from '@refinedev/core';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
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
  eventStatuses,
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
  const { search } = useLocation();
  const state = useMemo(() => readEventList(search), [search]);
  const latestState = useRef(state);
  useEffect(() => {
    latestState.current = state;
  }, [state]);
  const filters = eventListFilters(state);
  const advancedCount = filters.filter(
    (filter) =>
      'field' in filter &&
      filter.field !== 'search' &&
      filter.field !== 'statuses' &&
      filter.field !== 'trashed',
  ).length;
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
  const [more, setMore] = useState(advancedCount > 0);
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
  function change(patch: Partial<EventListState>) {
    // Consecutive controls must retain URL changes still awaiting a router render.
    const next = { ...latestState.current, page: 1, ...patch };
    latestState.current = next;
    void navigate(`/${resource}${eventListSearch(next)}`);
  }
  function clearFilters() {
    setMore(false);
    change({
      ...readEventList(''),
      sort: state.sort,
      order: state.order,
      size: state.size,
      trashed: state.trashed,
    });
  }
  // Deletions or a bookmarked page can put the page beyond the current result set.
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
      /* Keep this view usable even when browser storage is blocked. */
    }
  }
  function restore(event: ReferenceEventListItemFragment) {
    if (submitting.current) return;
    submitting.current = true;
    actions.mutate(
      {
        url: resource,
        method: 'post',
        values: { action: 'restore', ids: [event.id] },
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
  return (
    <>
      <Breadcrumb
        className="page-breadcrumb"
        items={[{ title: 'Reference' }, { title: 'Events' }]}
      />
      <Card
        className="page-header"
        title="Events"
        extra={
          <Link to={eventLink(resource, 'create', search)}>
            <Button type="primary">Create event</Button>
          </Link>
        }
      >
        <Typography.Text type="secondary">
          {storeName} ·{' '}
          {events.query.isPending
            ? 'Loading events…'
            : events.query.isError
              ? 'Events unavailable'
              : `${String(events.result.total ?? 0)} ${filterCount ? 'matching ' : ''}${events.result.total === 1 ? 'event' : 'events'}${state.trashed ? ' in trash' : ''}`}
        </Typography.Text>
        <Tabs
          activeKey={state.trashed ? 'trash' : 'active'}
          items={[
            { key: 'active', label: 'Active' },
            { key: 'trash', label: 'Trash' },
          ]}
          onChange={(view) => {
            change({ trashed: view === 'trash' });
          }}
        />
      </Card>
      {notice && (
        <Alert
          className="form-error"
          type="success"
          role="status"
          showIcon
          message={notice}
          onClose={() => {
            setNotice('');
          }}
          closable
        />
      )}
      {actions.mutation.isError && (
        <Alert
          className="form-error"
          type="error"
          showIcon
          message={actions.mutation.error.message}
        />
      )}
      <Card>
        <div className="event-list-toolbar">
          <Input.Search
            type="search"
            key={state.search}
            aria-label="Search events"
            placeholder="Search title or code"
            defaultValue={state.search}
            maxLength={200}
            allowClear
            onSearch={(value) => {
              change({ search: value });
            }}
            className="event-search"
          />
          <Select
            mode="multiple"
            aria-label="Filter status"
            placeholder="All statuses"
            allowClear
            value={state.statuses}
            options={eventStatuses}
            className="event-status-filter"
            onChange={(statuses: EventListState['statuses']) => {
              change({ statuses });
            }}
          />
          <Button
            aria-expanded={more}
            onClick={() => {
              setMore(!more);
            }}
          >
            More filters{advancedCount ? ` (${String(advancedCount)})` : ''}
          </Button>
          <Popover
            trigger="click"
            placement="bottomRight"
            title="Visible columns"
            content={
              <div className="event-column-options">
                <Checkbox.Group
                  options={eventColumnChoices}
                  value={visible}
                  onChange={saveColumns}
                />
                <Button
                  type="link"
                  onClick={() => {
                    saveColumns(defaultEventColumns);
                  }}
                >
                  Reset columns
                </Button>
              </div>
            }
          >
            <Button>Columns</Button>
          </Popover>
          {filterCount > 0 && <Button onClick={clearFilters}>Reset filters</Button>}
        </div>
        {more && (
          <EventFilters
            key={JSON.stringify([
              state.formats,
              state.venueIds,
              state.tagIds,
              state.featured,
              state.from,
              state.to,
              state.capacityMin,
              state.capacityMax,
            ])}
            storeId={storeId}
            state={state}
            onApply={change}
          />
        )}
        <div className="event-list-sort">
          <Space wrap>
            <Typography.Text type="secondary">Sort by</Typography.Text>
            <Select
              aria-label="Sort events by"
              value={state.sort}
              options={[
                { value: 'startsAt', label: 'Start' },
                { value: 'title', label: 'Title' },
                { value: 'status', label: 'Status' },
                { value: 'capacity', label: 'Capacity' },
                { value: 'budget', label: 'Budget' },
                { value: 'createdAt', label: 'Created' },
              ]}
              onChange={(sort: EventListState['sort']) => {
                change({ sort });
              }}
            />
            <Button
              onClick={() => {
                change({ order: state.order === 'asc' ? 'desc' : 'asc' });
              }}
            >
              {state.order === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
          </Space>
          <Typography.Text type="secondary">All times in Europe/Sofia</Typography.Text>
        </div>
        {events.query.isError && (
          <Alert
            className="form-error"
            type="error"
            showIcon
            message={events.query.error.message}
            action={
              <Button
                onClick={() => {
                  void events.query.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
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
        <Table<ReferenceEventListItemFragment>
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => {
              setSelection({ search, ids: keys.map(String) });
            },
            getCheckboxProps: () => ({ disabled: events.query.isFetching }),
            columnWidth: 64,
          }}
          loading={events.query.isFetching}
          dataSource={events.query.isError ? [] : events.result.data}
          scroll={{ x: 850 + Math.max(0, visible.length - 3) * 150 }}
          locale={{
            emptyText: events.query.isPending ? (
              'Loading events…'
            ) : events.query.isError ? (
              'Events unavailable'
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  filterCount
                    ? 'No events match these filters.'
                    : state.trashed
                      ? 'Trash is empty.'
                      : 'No events in this store yet.'
                }
              >
                {filterCount ? (
                  <Button onClick={clearFilters}>Clear filters</Button>
                ) : !state.trashed ? (
                  <Link to={eventLink(resource, 'create', search)}>
                    <Button type="primary">Create your first event</Button>
                  </Link>
                ) : null}
              </Empty>
            ),
          }}
          pagination={{
            current: state.page,
            pageSize: state.size,
            total: events.result.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `${String(total)} ${total === 1 ? 'event' : 'events'}`,
          }}
          onChange={(pagination, _, sorter, extra) => {
            if (extra.action === 'paginate')
              change({
                page: pagination.pageSize === state.size ? (pagination.current ?? 1) : 1,
                size: pagination.pageSize ?? 20,
              });
            if (extra.action === 'sort' && !Array.isArray(sorter)) {
              const field = String(sorter.columnKey);
              change({
                sort: sorter.order && isEventSortField(field) ? field : 'startsAt',
                order: sorter.order === 'descend' ? 'desc' : 'asc',
              });
            }
          }}
          columns={[
            ...eventColumns({ resource, search, state, visible }),
            {
              title: 'Actions',
              key: 'actions',
              width: 210,
              render: (_: unknown, event) =>
                event.deletedAt ? (
                  <Button
                    type="link"
                    disabled={actions.mutation.isPending}
                    onClick={() => {
                      restore(event);
                    }}
                    aria-label={`Restore ${event.title}`}
                  >
                    Restore
                  </Button>
                ) : (
                  <Space>
                    <Link to={eventLink(resource, `${event.id}/edit`, search)}>Edit</Link>
                    <Button
                      type="link"
                      danger
                      onClick={() => {
                        deletion.mutation.reset();
                        setSelected(event);
                      }}
                      aria-label={`Move ${event.title} to trash`}
                    >
                      Move to trash
                    </Button>
                  </Space>
                ),
            },
          ]}
        />
        <Modal
          title="Move event to trash?"
          open={Boolean(selected)}
          onCancel={() => {
            if (!deletion.mutation.isPending) setSelected(undefined);
          }}
          onOk={remove}
          okText="Move to trash"
          okButtonProps={{ danger: true }}
          confirmLoading={deletion.mutation.isPending}
          cancelButtonProps={{ disabled: deletion.mutation.isPending }}
          closable={!deletion.mutation.isPending}
          maskClosable={!deletion.mutation.isPending}
        >
          <Typography.Paragraph>
            {selected?.title} will be removed from the active list.
          </Typography.Paragraph>
          {deletion.mutation.isError && (
            <Alert type="error" message={deletion.mutation.error.message} showIcon />
          )}
        </Modal>
      </Card>
    </>
  );
}
