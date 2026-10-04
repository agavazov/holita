import { useList } from '@refinedev/core';
import {
  Alert,
  Autocomplete,
  Button,
  Pagination,
  Paper,
  Stack,
  TextField,
  type PaperProps,
} from '@mui/material';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DataError } from '../../data/data-provider.js';
import { useLocalization } from '../../localization/localization-provider.js';

type LookupRow = { id: string; name: string; active: boolean };
type Props = {
  resource: string;
  value?: string | string[] | null;
  onChange?: (value: string | string[] | undefined) => void;
  multiple?: boolean;
  id?: string;
  label?: string;
  name?: string;
  error?: boolean;
  helperText?: ReactNode;
  disabled?: boolean;
  activeOnly?: boolean;
};
// A stable paper component keeps focus and the open popup when a remote page changes.
const PopupExtras = createContext<ReactNode>(null);
function RelationPaper({ children, ...props }: PaperProps) {
  const extras = useContext(PopupExtras);
  return (
    <Paper {...props}>
      {children}
      {extras}
    </Paper>
  );
}
export function RelationSelect({
  resource,
  value,
  onChange,
  multiple = false,
  id,
  label,
  name,
  error,
  helperText,
  disabled = false,
  activeOnly = true,
}: Props) {
  const { t } = useLocalization();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [search]);
  const choices = useList<LookupRow, DataError>({
    resource,
    pagination: { currentPage: page, pageSize: 20, mode: 'server' },
    filters: [
      { field: 'search', operator: 'contains', value: query },
      ...(activeOnly ? [{ field: 'active', operator: 'eq' as const, value: true }] : []),
    ],
    errorNotification: false,
  });
  const selectedIds = value ? (Array.isArray(value) ? value : [value]) : [];
  const selected = useList<LookupRow, DataError>({
    resource,
    pagination: { currentPage: 1, pageSize: 100, mode: 'server' },
    filters: [{ field: 'ids', operator: 'in', value: selectedIds }],
    queryOptions: { enabled: selectedIds.length > 0 },
    errorNotification: false,
  });
  const options = new Map(
    [...choices.result.data, ...(selectedIds.length ? selected.result.data : [])].map((row) => [
      row.id,
      row,
    ]),
  );
  const failure = choices.query.error ?? (selectedIds.length ? selected.query.error : null);
  return (
    <PopupExtras.Provider
      value={
        <Stack
          sx={{ p: 1 }}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
        >
          {failure && (
            <Alert
              severity="error"
              action={
                <Button
                  onClick={() => {
                    void choices.query.refetch();
                    if (selectedIds.length) void selected.query.refetch();
                  }}
                >
                  {t('common.retry')}
                </Button>
              }
            >
              {t('common.genericError')}
            </Alert>
          )}
          {(choices.result.total ?? 0) > 20 && (
            <Pagination
              size="small"
              count={Math.ceil((choices.result.total ?? 0) / 20)}
              page={page}
              onChange={(_, next) => {
                setPage(next);
              }}
            />
          )}
        </Stack>
      }
    >
      <Autocomplete
        {...(id ? { id } : {})}
        fullWidth
        disabled={disabled}
        multiple={multiple}
        value={multiple ? selectedIds : (selectedIds[0] ?? null)}
        options={[...options.keys()]}
        getOptionLabel={(key) => {
          const row = options.get(key);
          return row
            ? `${row.name}${row.active ? '' : ` (${t('reference.inactive').toLowerCase()})`}`
            : t('common.loading');
        }}
        getOptionDisabled={(key) =>
          activeOnly && options.get(key)?.active === false && !selectedIds.includes(key)
        }
        filterOptions={(rows) => rows}
        onChange={(_, next) => {
          onChange?.(next ?? undefined);
        }}
        onInputChange={(_, next, reason) => {
          if (reason === 'input' || reason === 'clear') setSearch(next);
          else if (reason === 'selectOption') setSearch('');
        }}
        loading={choices.query.isFetching}
        noOptionsText={
          failure ? t('reference.recordsLoadError') : t('reference.noMatchingRecords')
        }
        slots={{ paper: RelationPaper }}
        renderInput={(params) => (
          <TextField
            {...params}
            name={name}
            label={label}
            placeholder={t('reference.searchByNameShort')}
            error={error}
            helperText={helperText}
          />
        )}
      />
    </PopupExtras.Provider>
  );
}
