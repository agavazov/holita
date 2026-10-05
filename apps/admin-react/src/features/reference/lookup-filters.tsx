import { useTranslation } from 'react-i18next';
import { Button, MenuItem, Typography } from '@mui/material';
import { FilterDrawer } from '../../components/filter-drawer.js';
import StyledTextField from '../../layout/primitives/styled-text-field.js';

export function LookupFilters({
  entity,
  open,
  onClose,
  search,
  status,
  disabled,
  onSearchChange,
  onStatusChange,
  onClear,
}: {
  entity: 'venues' | 'speakers' | 'tags';
  open: boolean;
  onClose: () => void;
  search: string;
  status: string;
  disabled: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation(['reference', 'common']);
  const singular = entity.slice(0, -1);
  return (
    <FilterDrawer open={open} onClose={onClose} label={t(`reference:${entity}.filters.title`)}>
      <StyledTextField
        id={`${singular}-filter-search`}
        label={t(`reference:${entity}.filters.search`)}
        type="search"
        fullWidth
        value={search}
        disabled={disabled}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
        helperText={t(`reference:${entity}.filters.searchHint`)}
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />
      <StyledTextField
        id={`${singular}-filter-status`}
        label={t('common:status.label')}
        select
        fullWidth
        value={status}
        disabled={disabled}
        onChange={(event) => {
          onStatusChange(event.target.value);
        }}
      >
        <MenuItem value="all">{t('common:status.all')}</MenuItem>
        <MenuItem value="ACTIVE">{t('common:status.active')}</MenuItem>
        <MenuItem value="INACTIVE">{t('common:status.inactive')}</MenuItem>
      </StyledTextField>
      <Typography variant="caption" color="text.secondary">
        {t('reference:lookups.autoApply')}
      </Typography>
      <Button
        variant="soft"
        color="neutral"
        disabled={disabled || (status === 'all' && !search)}
        onClick={onClear}
      >
        {t('common:actions.clearFilters')}
      </Button>
    </FilterDrawer>
  );
}
