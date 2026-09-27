import { Tag, Typography, type TableColumnsType } from 'antd';
import { Link } from 'react-router';
import type { ReferenceEventListItemFragment } from '../../../generated/graphql/operations.js';
import { eventLink, eventFormats, eventStatuses, type EventListState } from './event-list-state.js';
import { eventTime } from './event-time.js';

export const eventColumnChoices = [
  { value: 'startsAt', label: 'Start' },
  { value: 'venue', label: 'Venue' },
  { value: 'status', label: 'Status' },
  { value: 'format', label: 'Format' },
  { value: 'capacity', label: 'Capacity' },
  { value: 'budget', label: 'Budget' },
  { value: 'featured', label: 'Featured' },
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
];
export const defaultEventColumns = ['startsAt', 'venue', 'status'];
export function readEventColumns(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (Array.isArray(value))
      return value.filter(
        (item: unknown): item is string =>
          typeof item === 'string' && eventColumnChoices.some((column) => column.value === item),
      );
  } catch {
    /* Browser storage may be unavailable. Use the default view. */
  }
  return defaultEventColumns;
}
export function eventColumns({
  resource,
  search,
  state,
  visible,
}: {
  resource: string;
  search: string;
  state: EventListState;
  visible: string[];
}): TableColumnsType<ReferenceEventListItemFragment> {
  const sort = (field: string) => ({
    sorter: true,
    sortOrder:
      state.sort === field
        ? state.order === 'asc'
          ? ('ascend' as const)
          : ('descend' as const)
        : null,
  });
  const columns: TableColumnsType<ReferenceEventListItemFragment> = [
    {
      title: 'Event',
      key: 'title',
      dataIndex: 'title',
      width: 270,
      ...sort('title'),
      render: (_: unknown, event) => (
        <div>
          <Link to={eventLink(resource, event.id, search)}>{event.title}</Link>
          <div>
            <Typography.Text type="secondary">{event.code}</Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Start (Sofia)',
      key: 'startsAt',
      dataIndex: 'startsAt',
      width: 190,
      ...sort('startsAt'),
      render: (value: string) => eventTime(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Venue',
      key: 'venue',
      width: 180,
      render: (_: unknown, event) =>
        event.venue?.name ?? (event.format === 'ONLINE' ? 'Online' : '—'),
    },
    {
      title: 'Status',
      key: 'status',
      dataIndex: 'status',
      ...sort('status'),
      render: (value: string) => (
        <Tag color={value === 'PUBLISHED' ? 'green' : 'default'}>
          {eventStatuses.find((status) => status.value === value)?.label}
        </Tag>
      ),
    },
    {
      title: 'Format',
      key: 'format',
      dataIndex: 'format',
      render: (value: string) => eventFormats.find((format) => format.value === value)?.label,
    },
    {
      title: 'Capacity',
      key: 'capacity',
      dataIndex: 'capacity',
      ...sort('capacity'),
      render: (value: number | null) => value?.toLocaleString() ?? '—',
    },
    {
      title: 'Budget (EUR)',
      key: 'budget',
      dataIndex: 'budget',
      ...sort('budget'),
      render: (value: string | null) =>
        value
          ? Number(value).toLocaleString('en-IE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '—',
    },
    {
      title: 'Featured',
      key: 'featured',
      dataIndex: 'featured',
      render: (value: boolean) => (value ? 'Yes' : 'No'),
    },
    {
      title: 'Created (Sofia)',
      key: 'createdAt',
      dataIndex: 'createdAt',
      ...sort('createdAt'),
      render: (value: string) => eventTime(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Updated (Sofia)',
      key: 'updatedAt',
      dataIndex: 'updatedAt',
      render: (value: string) => eventTime(value).format('DD MMM YYYY, HH:mm'),
    },
  ];
  return columns.filter((column) => column.key === 'title' || visible.includes(String(column.key)));
}
