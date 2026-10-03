// Aurora Member filters, using Product fields.
import { Button, MenuItem, Typography } from '@mui/material';
import { FilterDrawer } from '../../components/filter-drawer.js';
import StyledTextField from '../../layout/primitives/styled-text-field.js';
import { useLocalization } from '../../localization/localization-provider.js';

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
  const { t } = useLocalization();

  return (
    <FilterDrawer open={open} onClose={onClose} label={t('products.filters')}>
      <StyledTextField
        id="filter-search"
        label={t('products.search')}
        type="search"
        fullWidth
        value={search}
        disabled={disabled}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
        helperText={t('products.searchHelp')}
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />
      <StyledTextField
        id="filter-status"
        label={t('products.status')}
        select
        fullWidth
        value={status}
        disabled={disabled}
        onChange={(event) => {
          onStatusChange(event.target.value);
        }}
      >
        <MenuItem value="all">{t('products.allStatuses')}</MenuItem>
        <MenuItem value="ACTIVE">{t('products.active')}</MenuItem>
        <MenuItem value="DRAFT">{t('products.draft')}</MenuItem>
      </StyledTextField>
      <StyledTextField
        id="filter-sku"
        label={t('products.skuContains')}
        value={sku}
        disabled={disabled}
        onChange={(event) => {
          onSkuChange(event.target.value);
        }}
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
      <Typography variant="caption" color="text.secondary">
        {t('products.filtersApply')}
      </Typography>
      <Button
        variant="soft"
        color="neutral"
        disabled={disabled || (status === 'all' && !sku && !search)}
        onClick={onClear}
      >
        {t('products.clearFilters')}
      </Button>
    </FilterDrawer>
  );
}
