// Aurora Member filters, using Product fields.
import { Button, MenuItem, Typography } from '@mui/material';
import { FilterDrawer } from '../../components/filter-drawer.js';
import StyledTextField from '../../layout/primitives/styled-text-field.js';

type ProductFiltersProps = {
  open: boolean;
  onClose: () => void;
  search: string;
  status: string;
  sku: string;
  disabled: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSkuChange: (value: string) => void;
  onClear: () => void;
};

export function ProductFilters({
  open,
  onClose,
  search,
  status,
  sku,
  disabled,
  onSearchChange,
  onStatusChange,
  onSkuChange,
  onClear,
}: ProductFiltersProps) {
  return (
    <FilterDrawer open={open} onClose={onClose} label="Product filters">
      <StyledTextField
        id="filter-search"
        label="Search products"
        type="search"
        fullWidth
        value={search}
        disabled={disabled}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
        helperText="Search by name or SKU."
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />
      <StyledTextField
        id="filter-status"
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
        <MenuItem value="DRAFT">Draft</MenuItem>
      </StyledTextField>
      <StyledTextField
        id="filter-sku"
        label="SKU contains"
        value={sku}
        disabled={disabled}
        onChange={(event) => {
          onSkuChange(event.target.value);
        }}
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
      <Typography variant="caption" color="text.secondary">
        All filters apply together automatically.
      </Typography>
      <Button
        variant="soft"
        color="neutral"
        disabled={disabled || (status === 'all' && !sku && !search)}
        onClick={onClear}
      >
        Clear filters
      </Button>
    </FilterDrawer>
  );
}
