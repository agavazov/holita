import { Button, MenuItem, Typography } from '@mui/material';
import { FilterDrawer } from '../../components/filter-drawer.js';
import StyledTextField from '../../layout/primitives/styled-text-field.js';
import { useLocalization } from '../../localization/localization-provider.js';

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
  const { t } = useLocalization();
  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      label={t('reference.lookupFilters', { name: singular })}
    >
      <StyledTextField
        id={`${singular}-filter-search`}
        label={t('reference.searchLookup', { name: title.toLowerCase() })}
        type="search"
        fullWidth
        value={search}
        disabled={disabled}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
        helperText={t('reference.searchByName', { name: singular })}
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />
      <StyledTextField
        id={`${singular}-filter-status`}
        label={t('reference.status')}
        select
        fullWidth
        value={status}
        disabled={disabled}
        onChange={(event) => {
          onStatusChange(event.target.value);
        }}
      >
        <MenuItem value="all">{t('reference.allStatuses')}</MenuItem>
        <MenuItem value="ACTIVE">{t('reference.active')}</MenuItem>
        <MenuItem value="INACTIVE">{t('reference.inactive')}</MenuItem>
      </StyledTextField>
      <Typography variant="caption" color="text.secondary">
        {t('reference.filtersApply')}
      </Typography>
      <Button
        variant="soft"
        color="neutral"
        disabled={disabled || (status === 'all' && !search)}
        onClick={onClear}
      >
        {t('reference.clearFilters')}
      </Button>
    </FilterDrawer>
  );
}
