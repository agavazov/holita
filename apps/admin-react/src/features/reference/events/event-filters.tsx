import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Autocomplete, Button, MenuItem, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { FilterDrawer } from '../../../components/filter-drawer.js';
import { tagsResource, venuesResource } from '../../../data/data-provider.js';
import { RelationSelect } from '../relation-select.js';
import { eventFormats, eventStatuses, type EventListState } from './event-list-state.js';

type RangeFields = { from: string; to: string; capacityMin: string; capacityMax: string };
function ranges(state: EventListState): RangeFields {
  return {
    from: state.from,
    to: state.to,
    capacityMin: state.capacityMin?.toString() ?? '',
    capacityMax: state.capacityMax?.toString() ?? '',
  };
}
function rangeErrors(value: RangeFields, t: TFunction<'validation'>) {
  const integer = (text: string) =>
    text !== '' &&
    (!Number.isInteger(Number(text)) || Number(text) < 1 || Number(text) > 2147483647)
      ? t('reference.rangeInteger')
      : '';
  return {
    from: '',
    to: value.from && value.to && value.to < value.from ? t('reference.dateRange') : '',
    capacityMin: integer(value.capacityMin),
    capacityMax:
      integer(value.capacityMax) ||
      (value.capacityMin &&
      value.capacityMax &&
      Number(value.capacityMax) < Number(value.capacityMin)
        ? t('reference.capacityRange')
        : ''),
  };
}
export function EventFilters({
  storeId,
  state,
  locationKey,
  search,
  open,
  onClose,
  onSearchChange,
  onChange,
  onClear,
}: {
  storeId: string;
  state: EventListState;
  locationKey: string;
  search: string;
  open: boolean;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onChange: (patch: Partial<EventListState>) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation(['validation', 'reference', 'common']);
  const [draft, setDraft] = useState(() => ranges(state));
  const rangeKey = JSON.stringify([locationKey, ranges(state)]);
  const [lastRange, setLastRange] = useState(rangeKey);
  if (rangeKey !== lastRange) {
    setLastRange(rangeKey);
    setDraft(ranges(state));
  }
  const errors = rangeErrors(draft, t);
  function changeRange(field: keyof RangeFields, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    if (Object.values(rangeErrors(next, t)).some(Boolean)) return;
    onChange({
      from: next.from,
      to: next.to,
      capacityMin: next.capacityMin ? Number(next.capacityMin) : undefined,
      capacityMax: next.capacityMax ? Number(next.capacityMax) : undefined,
    });
  }
  return (
    <FilterDrawer label={t('reference:events.filters.title')} open={open} onClose={onClose}>
      <TextField
        label={t('reference:events.filters.search')}
        type="search"
        value={search}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
        slotProps={{ htmlInput: { maxLength: 200 } }}
        helperText={t('reference:events.filters.searchHint')}
      />
      <Autocomplete
        multiple
        options={eventStatuses}
        value={state.statuses}
        getOptionLabel={(value) => t(`reference:events.status.${value}`)}
        onChange={(_, next) => {
          onChange({ statuses: next });
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('common:status.label')}
            placeholder={t('common:status.all')}
          />
        )}
      />
      <Autocomplete
        multiple
        options={eventFormats}
        value={state.formats}
        getOptionLabel={(value) => t(`reference:events.format.${value}`)}
        onChange={(_, next) => {
          onChange({ formats: next });
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('reference:fields.format')}
            placeholder={t('reference:events.filters.allFormats')}
          />
        )}
      />
      <RelationSelect
        label={t('reference:fields.venue')}
        resource={venuesResource(storeId)}
        multiple
        activeOnly={false}
        value={state.venueIds}
        onChange={(value) => {
          onChange({ venueIds: Array.isArray(value) ? value : [] });
        }}
      />
      <RelationSelect
        label={t('reference:fields.tag')}
        resource={tagsResource(storeId)}
        multiple
        activeOnly={false}
        value={state.tagIds}
        onChange={(value) => {
          onChange({ tagIds: Array.isArray(value) ? value : [] });
        }}
      />
      <TextField
        select
        label={t('reference:fields.featured')}
        value={state.featured === undefined ? 'all' : String(state.featured)}
        onChange={(event) => {
          onChange({
            featured: event.target.value === 'all' ? undefined : event.target.value === 'true',
          });
        }}
      >
        <MenuItem value="all">{t('reference:events.filters.allEvents')}</MenuItem>
        <MenuItem value="true">{t('reference:fields.featured')}</MenuItem>
        <MenuItem value="false">{t('reference:events.filters.notFeatured')}</MenuItem>
      </TextField>
      <Typography variant="subtitle2">{t('reference:events.filters.startDate')}</Typography>
      <TextField
        label={t('reference:events.filters.from')}
        type="date"
        value={draft.from}
        onChange={(event) => {
          changeRange('from', event.target.value);
        }}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        label={t('reference:events.filters.to')}
        type="date"
        value={draft.to}
        onChange={(event) => {
          changeRange('to', event.target.value);
        }}
        error={Boolean(errors.to)}
        helperText={errors.to}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <Typography variant="subtitle2">{t('reference:fields.capacity')}</Typography>
      <TextField
        label={t('reference:events.filters.minimum')}
        type="number"
        value={draft.capacityMin}
        onChange={(event) => {
          changeRange('capacityMin', event.target.value);
        }}
        error={Boolean(errors.capacityMin)}
        helperText={errors.capacityMin}
        slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
      />
      <TextField
        label={t('reference:events.filters.maximum')}
        type="number"
        value={draft.capacityMax}
        onChange={(event) => {
          changeRange('capacityMax', event.target.value);
        }}
        error={Boolean(errors.capacityMax)}
        helperText={errors.capacityMax}
        slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
      />
      <Button color="neutral" variant="soft" onClick={onClear}>
        {t('common:actions.resetFilters')}
      </Button>
    </FilterDrawer>
  );
}
