import { Chip, Link, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { Link as RouterLink } from 'react-router';

import type { ReferenceEventListItemFragment } from '../../../generated/graphql/operations.js';
import type { TranslationKey } from '../../../localization/dictionaries.js';
import type { AdminLocale } from '../../../localization/locale.js';
import { eventLink } from './event-list-state.js';
import { eventTime } from './event-time.js';

export const eventColumnChoices: ReadonlyArray<{
  value: string;
  labelKey: TranslationKey;
}> = [
  { value: 'startsAt', labelKey: 'reference.events.columnStart' },
  { value: 'venue', labelKey: 'reference.events.columnVenue' },
  { value: 'status', labelKey: 'reference.events.columnStatus' },
  { value: 'format', labelKey: 'reference.events.columnFormat' },
  { value: 'capacity', labelKey: 'reference.events.columnCapacity' },
  { value: 'budget', labelKey: 'reference.events.columnBudget' },
  { value: 'featured', labelKey: 'reference.events.columnFeatured' },
  { value: 'createdAt', labelKey: 'reference.events.columnCreated' },
  { value: 'updatedAt', labelKey: 'reference.events.columnUpdated' },
];
export const defaultEventColumns = ['startsAt', 'venue', 'status'];

export function readEventColumns(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (Array.isArray(value)) {
      return value.filter(
        (item: unknown): item is string =>
          typeof item === 'string' && eventColumnChoices.some((column) => column.value === item),
      );
    }
  } catch {
    /* Browser storage may be unavailable. Use the default view. */
  }
  return defaultEventColumns;
}

export function eventColumns(
  locale: AdminLocale,
  resource: string,
  search: string,
  t: (key: TranslationKey) => string,
): GridColDef<ReferenceEventListItemFragment>[] {
  const intlLocale = locale === 'bg' ? 'bg-BG' : 'en-GB';
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(intlLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Sofia',
    }).format(eventTime(value).toDate());
  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(intlLocale, options).format(value);
  const statusLabel = (status: ReferenceEventListItemFragment['status']) =>
    t(
      status === 'PUBLISHED'
        ? 'reference.events.statusPublished'
        : status === 'ARCHIVED'
          ? 'reference.events.statusArchived'
          : 'reference.events.statusDraft',
    );
  const formatLabel = (format: ReferenceEventListItemFragment['format']) =>
    t(
      format === 'ONLINE'
        ? 'reference.events.formatOnline'
        : format === 'HYBRID'
          ? 'reference.events.formatHybrid'
          : 'reference.events.formatInPerson',
    );

  return [
    {
      field: 'title',
      headerName: t('reference.events.columnEvent'),
      flex: 2,
      minWidth: 240,
      renderCell: ({ row, tabIndex }) => (
        <Stack sx={{ justifyContent: 'center', height: '100%', minWidth: 0 }}>
          <Link
            component={RouterLink}
            to={eventLink(locale, resource, `${row.id}${row.deletedAt ? '' : '/edit'}`, search)}
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
      headerName: t('reference.events.columnStartSofia'),
      minWidth: 190,
      flex: 1,
      renderCell: ({ row }) => formatDate(row.startsAt),
    },
    {
      field: 'venue',
      headerName: t('reference.events.columnVenue'),
      minWidth: 180,
      flex: 1,
      sortable: false,
      renderCell: ({ row }) =>
        row.venue?.name ?? (row.format === 'ONLINE' ? formatLabel(row.format) : '—'),
    },
    {
      field: 'status',
      headerName: t('reference.events.columnStatus'),
      minWidth: 120,
      flex: 1,
      renderCell: ({ row }) => (
        <Chip
          color={row.status === 'PUBLISHED' ? 'success' : 'neutral'}
          label={statusLabel(row.status)}
        />
      ),
    },
    {
      field: 'format',
      headerName: t('reference.events.columnFormat'),
      minWidth: 130,
      sortable: false,
      renderCell: ({ row }) => formatLabel(row.format),
    },
    {
      field: 'capacity',
      headerName: t('reference.events.columnCapacity'),
      minWidth: 130,
      renderCell: ({ row }) => (row.capacity == null ? '—' : formatNumber(row.capacity)),
    },
    {
      field: 'budget',
      headerName: t('reference.events.columnBudgetEur'),
      minWidth: 160,
      renderCell: ({ row }) =>
        row.budget
          ? formatNumber(Number(row.budget), {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '—',
    },
    {
      field: 'featured',
      headerName: t('reference.events.columnFeatured'),
      minWidth: 120,
      sortable: false,
      renderCell: ({ row }) => t(row.featured ? 'reference.events.yes' : 'reference.events.no'),
    },
    {
      field: 'createdAt',
      headerName: t('reference.events.columnCreatedSofia'),
      minWidth: 190,
      renderCell: ({ row }) => formatDate(row.createdAt),
    },
    {
      field: 'updatedAt',
      headerName: t('reference.events.columnUpdatedSofia'),
      minWidth: 190,
      sortable: false,
      renderCell: ({ row }) => formatDate(row.updatedAt),
    },
  ];
}
