import { Button, MenuItem, Typography } from '@mui/material';
import { FilterDrawer } from '../../components/filter-drawer.js';
import StyledTextField from '../../layout/primitives/styled-text-field.js';

export function LookupFilters({
  singular,
  title,
  open,
  onClose,
  search,
  status,
  disabled,
  onSearchChange,
  onStatusChange,
  onClear,
}: {
  singular: string;
  title: string;
  open: boolean;
  onClose: () => void;
  search: string;
  status: string;
  disabled: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      label={`${singular.charAt(0).toUpperCase() + singular.slice(1)} filters`}
    >
      <StyledTextField
        id={`${singular}-filter-search`}
        label={`Search ${title.toLowerCase()}`}
        type="search"
        fullWidth
        value={search}
        disabled={disabled}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
        helperText={`Search by ${singular} name.`}
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />
      <StyledTextField
        id={`${singular}-filter-status`}
        label="Status"
        select
        fullWidth
        value={status}
        disabled={disabled}
        onChange={(event) => {
          onStatusChange(event.target.value);
        }}
      >
        <MenuItem value="all">All statuses</MenuItem>
        <MenuItem value="ACTIVE">Active</MenuItem>
        <MenuItem value="INACTIVE">Inactive</MenuItem>
      </StyledTextField>
      <Typography variant="caption" color="text.secondary">
        All filters apply together automatically.
      </Typography>
      <Button
        variant="soft"
        color="neutral"
        disabled={disabled || (status === 'all' && !search)}
        onClick={onClear}
      >
        Clear filters
      </Button>
    </FilterDrawer>
  );
}
