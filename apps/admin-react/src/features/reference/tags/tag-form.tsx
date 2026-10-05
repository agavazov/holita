import { useTranslation } from 'react-i18next';
// Aurora CreateEvent composition with Tag fields and validation.
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  InputAdornment,
  Chip,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ContentSection } from '../../../components/content-section.js';
import { EditorAside } from '../../../components/editor-aside.js';
import type { DataError } from '../../../data/data-provider.js';
import type { CreateReferenceTagInput } from '../../../generated/graphql/operations.js';
import { textError } from '../text-validation.js';

type TagFormProps = {
  header?: ReactNode;
  initialValues?: CreateReferenceTagInput | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateReferenceTagInput) => void;
  onCancel: () => void;
  onChange: () => void;
};

export function TagForm({
  header,
  initialValues,
  pending,
  error,
  onSubmit,
  onCancel,
  onChange,
}: TagFormProps) {
  const { t } = useTranslation(['validation', 'reference', 'common']);
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({
    name: initialValues?.name ?? '',
    color: initialValues?.color ?? '#315ed0',
    active: initialValues?.active ?? true,
  });
  const [attempted, setAttempted] = useState(false);
  const errors = {
    name: textError(values.name, 100, t('reference.tagName'), t),
    color: /^#[0-9a-f]{6}$/i.test(values.color.trim()) ? '' : t('reference.color'),
    active: '',
  };
  function message(field: keyof typeof values) {
    return (
      (attempted && errors[field]) ||
      error?.fieldErrors.find(({ path }) => path === field)?.message ||
      ''
    );
  }
  function change<Field extends keyof typeof values>(field: Field, value: (typeof values)[Field]) {
    setValues({ ...values, [field]: value });
    onChange();
  }
  useEffect(() => {
    const first = error?.fieldErrors.find(({ path }) => form.current?.elements.namedItem(path));
    const input = first && form.current?.elements.namedItem(first.path);
    if (input instanceof HTMLElement) input.focus();
  }, [error]);

  return (
    <Stack
      component="form"
      ref={form}
      noValidate
      direction={{ xs: 'column', md: 'row' }}
      sx={{ flex: 1, minWidth: 0 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        setAttempted(true);
        const first = Object.entries(errors).find(([, value]) => value);
        if (first) {
          const input = form.current?.elements.namedItem(first[0]);
          if (input instanceof HTMLElement) input.focus();
          return;
        }
        onSubmit({
          name: values.name.trim(),
          color: values.color.trim().toLowerCase(),
          active: values.active,
        });
      }}
    >
      <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1, minWidth: 0 }}>
        {header}
        <Stack sx={{ gap: 4, maxWidth: 520, mx: 'auto' }}>
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
          <ContentSection
            title={t('reference:tags.form.details')}
            description={t('reference:tags.form.description')}
          >
            <TextField
              id={`${id}-name`}
              name="name"
              label={t('reference:fields.name')}
              autoFocus
              autoComplete="off"
              fullWidth
              disabled={pending}
              value={values.name}
              onChange={(event) => {
                change('name', event.target.value);
              }}
              error={Boolean(message('name'))}
              helperText={message('name') || t('reference:lookups.nameHint')}
            />
            <TextField
              id={`${id}-color`}
              name="color"
              label={t('reference:fields.color')}
              autoComplete="off"
              fullWidth
              disabled={pending}
              value={values.color}
              onChange={(event) => {
                change('color', event.target.value);
              }}
              error={Boolean(message('color'))}
              helperText={message('color') || t('reference:tags.form.colorHint')}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Box
                        component="input"
                        type="color"
                        aria-label={t('reference:tags.form.chooseColor')}
                        value={errors.color ? '#315ed0' : values.color.trim()}
                        disabled={pending}
                        onChange={(event) => {
                          change('color', event.target.value);
                        }}
                        sx={{
                          width: 32,
                          height: 32,
                          p: 0,
                          border: 0,
                          bgcolor: 'transparent',
                          cursor: 'pointer',
                        }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </ContentSection>
        </Stack>
      </Paper>
      <EditorAside
        label={t('reference:tags.form.settings')}
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="contained"
              type="submit"
              aria-label={t('reference:tags.actions.save')}
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              {t('reference:tags.actions.save')}
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            {t('common:status.label')}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                name="active"
                checked={values.active}
                disabled={pending}
                onChange={(_, checked) => {
                  change('active', checked);
                }}
                slotProps={{ input: { role: 'switch' } }}
              />
            }
            label={t('common:status.active')}
          />
          {message('active') && (
            <Typography variant="caption" color="error">
              {message('active')}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {values.active
              ? t('reference:tags.form.assignmentHint')
              : t('reference:tags.form.preservedHint')}
          </Typography>
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {t('common:summary')}
          </Typography>
          <Chip
            label={values.name.trim() || t('reference:tags.form.untitled')}
            variant="outlined"
            icon={
              <Box
                component="span"
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: errors.color ? 'action.disabled' : values.color.trim(),
                }}
              />
            }
            sx={{ alignSelf: 'flex-start', maxWidth: '100%' }}
          />
          <Typography variant="body2" color="text.secondary">
            {initialValues
              ? t('reference:tags.form.editHint')
              : t('reference:tags.form.createHint')}
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
