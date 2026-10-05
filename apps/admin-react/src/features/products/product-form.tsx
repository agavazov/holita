// Aurora CreateEvent / EventAside composition, bound to the existing Product inputs.
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentSection } from '../../components/content-section.js';
import { EditorAside } from '../../components/editor-aside.js';
import type { DataError } from '../../data/data-provider.js';
import type { CreateProductInput } from '../../generated/graphql/operations.js';

type ProductFormProps = {
  header?: ReactNode;
  initialValues?: CreateProductInput | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateProductInput) => void;
  onCancel: () => void;
  onChange?: () => void;
};

export function ProductForm({
  header,
  initialValues,
  pending,
  error,
  onSubmit,
  onCancel,
  onChange,
}: ProductFormProps) {
  const { t } = useTranslation(['products', 'common', 'validation']);
  function fieldError(value: string, field: 'name' | 'sku', max: number) {
    if (!value.trim()) return t(`validation:products.${field}Required`);
    if (value.includes('\u0000')) return t('validation:text.unsupportedCharacters');
    if (Array.from(value.trim()).length > max) return t('validation:text.maxLength', { max });
    return '';
  }
  const id = useId();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [sku, setSku] = useState(initialValues?.sku ?? '');
  const [status, setStatus] = useState(initialValues?.status ?? 'DRAFT');
  const [attempted, setAttempted] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const skuInput = useRef<HTMLInputElement>(null);
  const nameError = fieldError(name, 'name', 200);
  const skuError = fieldError(sku, 'sku', 100);
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
        <ContentSection
          title={t('form.details')}
          description={t('form.description')}
          sx={{ maxWidth: 520, mx: 'auto' }}
        >
          {error && (
            <Alert severity="error">
              {error.message}
              {error.requestId && (
                <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                  {t('common:requestId', { id: error.requestId })}
                </Typography>
              )}
            </Alert>
          )}
          <TextField
            id={`${id}-name`}
            label={t('form.name')}
            autoFocus
            autoComplete="off"
            fullWidth
            disabled={pending}
            inputRef={nameInput}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              onChange?.();
            }}
            error={attempted && Boolean(nameError)}
            helperText={attempted && nameError ? nameError : t('form.nameHint')}
          />
          <TextField
            id={`${id}-sku`}
            label={t('form.sku')}
            autoComplete="off"
            fullWidth
            disabled={pending}
            inputRef={skuInput}
            value={sku}
            onChange={(event) => {
              setSku(event.target.value);
              onChange?.();
            }}
            error={attempted && Boolean(skuError)}
            helperText={attempted && skuError ? skuError : t('form.skuHint')}
          />
        </ContentSection>
      </Paper>
      <EditorAside
        label={t('form.settings')}
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="contained"
              type="submit"
              aria-label={t('actions.save')}
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              {t('actions.save')}
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 3 }}>
          <Typography variant="h6" component="h2">
            {t('status.label')}
          </Typography>
          <TextField
            id={`${id}-status`}
            label={t('status.label')}
            select
            fullWidth
            value={status}
            disabled={pending}
            onChange={(event) => {
              if (event.target.value === 'ACTIVE' || event.target.value === 'DRAFT') {
                setStatus(event.target.value);
                onChange?.();
              }
            }}
          >
            <MenuItem value="DRAFT">{t('status.draft')}</MenuItem>
            <MenuItem value="ACTIVE">{t('status.active')}</MenuItem>
          </TextField>
          <Typography variant="body2" color="text.secondary">
            {status === 'ACTIVE' ? t('form.activeHint') : t('form.draftHint')}
          </Typography>
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {t('common:summary')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {name.trim() || t('form.untitled')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('form.skuSummary', { sku: sku.trim() || t('common:notSet') })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialValues ? t('form.editHint') : t('form.createHint')}
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
