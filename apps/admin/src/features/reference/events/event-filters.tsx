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
function rangeErrors(value: RangeFields) {
  const integer = (text: string) =>
    text !== '' &&
    (!Number.isInteger(Number(text)) || Number(text) < 1 || Number(text) > 2147483647)
      ? 'Use a positive whole number.'
      : '';
  return {
    from: '',
    to:
      value.from && value.to && value.to < value.from
        ? 'End date must be on or after the start.'
        : '',
    capacityMin: integer(value.capacityMin),
    capacityMax:
      integer(value.capacityMax) ||
      (value.capacityMin &&
      value.capacityMax &&
      Number(value.capacityMax) < Number(value.capacityMin)
        ? 'Maximum must be at least the minimum.'
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
  const [draft, setDraft] = useState(() => ranges(state));
  const rangeKey = JSON.stringify([locationKey, ranges(state)]);
  const [lastRange, setLastRange] = useState(rangeKey);
  if (rangeKey !== lastRange) {
    setLastRange(rangeKey);
    setDraft(ranges(state));
  }
  const errors = rangeErrors(draft);
  function changeRange(field: keyof RangeFields, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    if (Object.values(rangeErrors(next)).some(Boolean)) return;
    onChange({
      from: next.from,
      to: next.to,
      capacityMin: next.capacityMin ? Number(next.capacityMin) : undefined,
      capacityMax: next.capacityMax ? Number(next.capacityMax) : undefined,
    });
  }
  return (
    <FilterDrawer label="Event filters" open={open} onClose={onClose}>
      <TextField
        label="Search title or code"
        type="search"
        value={search}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
        slotProps={{ htmlInput: { maxLength: 200 } }}
        helperText="The same search as the list toolbar. All filters combine."
      />
      <Autocomplete
        multiple
        options={eventStatuses}
        value={eventStatuses.filter(({ value }) => state.statuses.includes(value))}
        getOptionLabel={(option) => option.label}
        onChange={(_, next) => {
          onChange({ statuses: next.map(({ value }) => value) });
        }}
        renderInput={(params) => (
          <TextField {...params} label="Status" placeholder="All statuses" />
        )}
      />
      <Autocomplete
        multiple
        options={eventFormats}
        value={eventFormats.filter(({ value }) => state.formats.includes(value))}
        getOptionLabel={(option) => option.label}
        onChange={(_, next) => {
          onChange({ formats: next.map(({ value }) => value) });
        }}
        renderInput={(params) => <TextField {...params} label="Format" placeholder="All formats" />}
      />
      <RelationSelect
        label="Venue"
        resource={venuesResource(storeId)}
        multiple
        activeOnly={false}
        value={state.venueIds}
        onChange={(value) => {
          onChange({ venueIds: Array.isArray(value) ? value : [] });
        }}
      />
      <RelationSelect
        label="Tag"
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
        label="Featured"
        value={state.featured === undefined ? 'all' : String(state.featured)}
        onChange={(event) => {
          onChange({
            featured: event.target.value === 'all' ? undefined : event.target.value === 'true',
          });
        }}
      >
        <MenuItem value="all">All events</MenuItem>
        <MenuItem value="true">Featured</MenuItem>
        <MenuItem value="false">Not featured</MenuItem>
      </TextField>
      <Typography variant="subtitle2">Start date (Europe/Sofia)</Typography>
      <TextField
        label="From date"
        type="date"
        value={draft.from}
        onChange={(event) => {
          changeRange('from', event.target.value);
        }}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        label="To date"
        type="date"
        value={draft.to}
        onChange={(event) => {
          changeRange('to', event.target.value);
        }}
        error={Boolean(errors.to)}
        helperText={errors.to}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <Typography variant="subtitle2">Capacity</Typography>
      <TextField
        label="Minimum capacity"
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
        label="Maximum capacity"
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
        Reset filters
      </Button>
    </FilterDrawer>
  );
}
