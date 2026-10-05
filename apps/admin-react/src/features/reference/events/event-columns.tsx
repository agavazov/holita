import type { TFunction } from 'i18next';
import type { createFormat } from '../../../i18n/use-format.js';
import { Chip, Link, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { Link as RouterLink } from 'react-router';
import type { ReferenceEventListItemFragment } from '../../../generated/graphql/operations.js';
import { eventLink } from './event-list-state.js';

export const eventColumnChoices = [
  { value: 'startsAt', label: 'reference:fields.start' },
  { value: 'venue', label: 'reference:fields.venue' },
  { value: 'status', label: 'common:status.label' },
  { value: 'format', label: 'reference:fields.format' },
  { value: 'capacity', label: 'reference:fields.capacity' },
  { value: 'budget', label: 'reference:fields.budget' },
  { value: 'featured', label: 'reference:fields.featured' },
  { value: 'createdAt', label: 'reference:fields.created' },
  { value: 'updatedAt', label: 'reference:fields.updated' },
] as const;
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
  localize: (path: string) => string,
  t: TFunction<['reference', 'common']>,
  format: ReturnType<typeof createFormat>,
): GridColDef<ReferenceEventListItemFragment>[] {
  return [
    {
      field: 'title',
      headerName: t('reference:events.singular'),
      flex: 2,
      minWidth: 240,
      renderCell: ({ row, tabIndex }) => (
        <Stack sx={{ justifyContent: 'center', height: '100%', minWidth: 0 }}>
          <Link
            component={RouterLink}
            to={localize(eventLink(resource, `${row.id}${row.deletedAt ? '' : '/edit'}`, search))}
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
      headerName: t('reference:fields.startSofia'),
      minWidth: 190,
      flex: 1,
      renderCell: ({ row }) => format.dateTime(row.startsAt),
    },
    {
      field: 'venue',
      headerName: t('reference:fields.venue'),
      minWidth: 180,
      flex: 1,
      sortable: false,
      renderCell: ({ row }) =>
        row.venue?.name ?? (row.format === 'ONLINE' ? t('reference:events.format.ONLINE') : '—'),
    },
    {
      field: 'status',
      headerName: t('common:status.label'),
      minWidth: 120,
      flex: 1,
      renderCell: ({ row }) => (
        <Chip
          color={row.status === 'PUBLISHED' ? 'success' : 'neutral'}
          label={t(`reference:events.status.${row.status}`)}
        />
      ),
    },
    {
      field: 'format',
      headerName: t('reference:fields.format'),
      minWidth: 130,
      sortable: false,
      renderCell: ({ row }) => t(`reference:events.format.${row.format}`),
    },
    {
      field: 'capacity',
      headerName: t('reference:fields.capacity'),
      minWidth: 130,
      renderCell: ({ row }) => (row.capacity === null ? null : format.number(row.capacity)) ?? '—',
    },
    {
      field: 'budget',
      headerName: t('reference:fields.budgetEur'),
      minWidth: 160,
      renderCell: ({ row }) => (row.budget ? format.decimal(row.budget) : '—'),
    },
    {
      field: 'featured',
      headerName: t('reference:fields.featured'),
      minWidth: 120,
      sortable: false,
      renderCell: ({ row }) => (row.featured ? t('common:yes') : t('common:no')),
    },
    {
      field: 'createdAt',
      headerName: t('reference:fields.createdSofia'),
      minWidth: 190,
      renderCell: ({ row }) => format.dateTime(row.createdAt),
    },
    {
      field: 'updatedAt',
      headerName: t('reference:fields.updatedSofia'),
      minWidth: 190,
      sortable: false,
      renderCell: ({ row }) => format.dateTime(row.updatedAt),
    },
  ];
}
