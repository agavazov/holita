import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['products', 'common']);
  return (
    <FilterDrawer open={open} onClose={onClose} label={t('filters.title')}>
      <StyledTextField
        id="filter-search"
        label={t('filters.search')}
        type="search"
        fullWidth
        value={search}
        disabled={disabled}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
        helperText={t('filters.searchHint')}
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />
      <StyledTextField
        id="filter-status"
        label={t('status.label')}
        select
        fullWidth
        value={status}
        disabled={disabled}
        onChange={(event) => {
          onStatusChange(event.target.value);
        }}
      >
        <MenuItem value="all">{t('status.all')}</MenuItem>
        <MenuItem value="ACTIVE">{t('status.active')}</MenuItem>
        <MenuItem value="DRAFT">{t('status.draft')}</MenuItem>
      </StyledTextField>
      <StyledTextField
        id="filter-sku"
        label={t('filters.sku')}
        value={sku}
        disabled={disabled}
        onChange={(event) => {
          onSkuChange(event.target.value);
        }}
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
      <Typography variant="caption" color="text.secondary">
        {t('filters.autoApply')}
      </Typography>
      <Button
        variant="soft"
        color="neutral"
        disabled={disabled || (status === 'all' && !sku && !search)}
        onClick={onClear}
      >
        {t('common:actions.clearFilters')}
      </Button>
    </FilterDrawer>
  );
}
