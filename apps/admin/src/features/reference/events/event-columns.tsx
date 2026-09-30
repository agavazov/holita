import { Chip, Link, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { Link as RouterLink } from 'react-router';
import type { ReferenceEventListItemFragment } from '../../../generated/graphql/operations.js';
import { eventLink, eventFormats, eventStatuses } from './event-list-state.js';
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
export function eventColumns(
  resource: string,
  search: string,
): GridColDef<ReferenceEventListItemFragment>[] {
  return [
    {
      field: 'title',
      headerName: 'Event',
      flex: 2,
      minWidth: 240,
      renderCell: ({ row, tabIndex }) => (
        <Stack sx={{ justifyContent: 'center', height: '100%', minWidth: 0 }}>
          <Link
            component={RouterLink}
            to={eventLink(resource, `${row.id}${row.deletedAt ? '' : '/edit'}`, search)}
            tabIndex={tabIndex}
            variant="subtitle2"
            sx={{ color: 'text.primary', fontWeight: 400 }}
            noWrap
          >
            {row.title}
          </Link>
          <Typography variant="caption" color="text.secondary" noWrap>
            {row.code}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'startsAt',
      headerName: 'Start (Sofia)',
      minWidth: 190,
      flex: 1,
      renderCell: ({ row }) => eventTime(row.startsAt).format('DD MMM YYYY, HH:mm'),
    },
    {
      field: 'venue',
      headerName: 'Venue',
      minWidth: 180,
      flex: 1,
      sortable: false,
      renderCell: ({ row }) => row.venue?.name ?? (row.format === 'ONLINE' ? 'Online' : '—'),
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 120,
      flex: 1,
      renderCell: ({ row }) => (
        <Chip
          color={row.status === 'PUBLISHED' ? 'success' : 'neutral'}
          label={eventStatuses.find(({ value }) => value === row.status)?.label}
        />
      ),
    },
    {
      field: 'format',
      headerName: 'Format',
      minWidth: 130,
      sortable: false,
      renderCell: ({ row }) => eventFormats.find(({ value }) => value === row.format)?.label,
    },
    {
      field: 'capacity',
      headerName: 'Capacity',
      minWidth: 130,
      renderCell: ({ row }) => row.capacity?.toLocaleString() ?? '—',
    },
    {
      field: 'budget',
      headerName: 'Budget (EUR)',
      minWidth: 160,
      renderCell: ({ row }) =>
        row.budget
          ? Number(row.budget).toLocaleString('en-IE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '—',
    },
    {
      field: 'featured',
      headerName: 'Featured',
      minWidth: 120,
      sortable: false,
      renderCell: ({ row }) => (row.featured ? 'Yes' : 'No'),
    },
    {
      field: 'createdAt',
      headerName: 'Created (Sofia)',
      minWidth: 190,
      renderCell: ({ row }) => eventTime(row.createdAt).format('DD MMM YYYY, HH:mm'),
    },
    {
      field: 'updatedAt',
      headerName: 'Updated (Sofia)',
      minWidth: 190,
      sortable: false,
      renderCell: ({ row }) => eventTime(row.updatedAt).format('DD MMM YYYY, HH:mm'),
    },
  ];
}
