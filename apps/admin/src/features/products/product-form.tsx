// Aurora CreateEvent / EventAside composition, bound to the existing Product inputs.
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useId, useRef, useState, type ReactNode } from 'react';
import { EditorAside } from '../../components/editor-aside.js';
import type { DataError } from '../../data/data-provider.js';
import type { CreateProductInput } from '../../generated/graphql/operations.js';
import { useLocalization } from '../../localization/localization-provider.js';

type ProductFormProps = {
  header?: ReactNode;
  initialValues?: CreateProductInput | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateProductInput) => void;
  onCancel: () => void;
};

export function ProductForm({
  header,
  initialValues,
  pending,
  error,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const { t } = useLocalization();
  const id = useId();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [sku, setSku] = useState(initialValues?.sku ?? '');
  const [status, setStatus] = useState(initialValues?.status ?? 'DRAFT');
  const [attempted, setAttempted] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const skuInput = useRef<HTMLInputElement>(null);
  const fieldError = (value: string, requiredKey: 'products.nameRequired' | 'products.skuRequired', max: number) => {
    if (!value.trim()) return t(requiredKey);
    if (value.includes('\u0000')) return t('products.unsupportedCharacters');
    if (Array.from(value.trim()).length > max) return t('products.maxCharacters', { count: max });
    return '';
  };
  const nameError = fieldError(name, 'products.nameRequired', 200);
  const skuError = fieldError(sku, 'products.skuRequired', 100);
  return (
    <Stack
      component="form"
      noValidate
      direction={{ xs: 'column', md: 'row' }}
      sx={{ flex: 1, minWidth: 0 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        setAttempted(true);
        if (nameError || skuError) {
          (nameError ? nameInput : skuInput).current?.focus();
          return;
        }
        onSubmit({ name: name.trim(), sku: sku.trim(), status });
      }}
    >
      <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1, minWidth: 0 }}>
        {header}
        <Stack sx={{ gap: 3, maxWidth: 520, mx: 'auto' }}>
          <Box>
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
              {t('products.details')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('products.detailsHelp')}
            </Typography>
          </Box>
          {error && (
            <Alert severity="error">
              {t('common.genericError')}
              {error.requestId && (
                <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                  {t('common.requestId')}: {error.requestId}
                </Typography>
              )}
            </Alert>
          )}
          <TextField
            id={`${id}-name`}
            label={t('products.name')}
            autoFocus
            autoComplete="off"
            fullWidth
            disabled={pending}
            inputRef={nameInput}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            error={attempted && Boolean(nameError)}
            helperText={
              attempted && nameError
                ? nameError
                : t('products.nameHelp')
            }
          />
          <TextField
            id={`${id}-sku`}
            label={t('products.sku')}
            autoComplete="off"
            fullWidth
            disabled={pending}
            inputRef={skuInput}
            value={sku}
            onChange={(event) => {
              setSku(event.target.value);
            }}
            error={attempted && Boolean(skuError)}
            helperText={
              attempted && skuError ? skuError : t('products.skuHelp')
            }
          />
        </Stack>
      </Paper>
      <EditorAside
        label={t('products.settings')}
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              {t('products.cancel')}
            </Button>
            <Button
              variant="contained"
              type="submit"
              aria-label={t('products.save')}
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              {t('products.save')}
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 3 }}>
          <Typography variant="h6" component="h2">
            {t('products.status')}
          </Typography>
          <TextField
            id={`${id}-status`}
            label={t('products.status')}
            select
            fullWidth
            value={status}
            disabled={pending}
            onChange={(event) => {
              if (event.target.value === 'ACTIVE' || event.target.value === 'DRAFT')
                setStatus(event.target.value);
            }}
          >
            <MenuItem value="DRAFT">{t('products.draft')}</MenuItem>
            <MenuItem value="ACTIVE">{t('products.active')}</MenuItem>
          </TextField>
          <Typography variant="body2" color="text.secondary">
            {status === 'ACTIVE'
              ? t('products.activeHelp')
              : t('products.draftHelp')}
          </Typography>
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {t('products.summary')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {name.trim() || t('products.untitled')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('products.sku')}: {sku.trim() || t('products.notSet')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialValues
              ? t('products.editSummary')
              : t('products.createSummary')}
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
