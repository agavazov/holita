import { useTranslation } from 'react-i18next';
// Aurora CreateEvent composition with Speaker fields and validation.
import {
  Alert,
  Button,
  FormControlLabel,
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
import type { CreateReferenceSpeakerInput } from '../../../generated/graphql/operations.js';
import { textError } from '../text-validation.js';

type SpeakerFormProps = {
  header?: ReactNode;
  initialValues?: CreateReferenceSpeakerInput | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateReferenceSpeakerInput) => void;
  onCancel: () => void;
  onChange: () => void;
};

export function SpeakerForm({
  header,
  initialValues,
  pending,
  error,
  onSubmit,
  onCancel,
  onChange,
}: SpeakerFormProps) {
  const { t } = useTranslation(['validation', 'reference', 'common']);
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({
    name: initialValues?.name ?? '',
    email: initialValues?.email ?? '',
    shortBio: initialValues?.shortBio ?? '',
    active: initialValues?.active ?? true,
  });
  const [attempted, setAttempted] = useState(false);
  const errors = {
    name: textError(values.name, 200, t('reference.speakerName'), t),
    email:
      textError(values.email, 254, '', t) ||
      (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
        ? t('reference.email')
        : ''),
    shortBio: textError(values.shortBio, 2000, '', t),
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
          email: values.email.trim() || null,
          shortBio: values.shortBio.trim() || null,
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
            title={t('reference:speakers.form.details')}
            description={t('reference:speakers.form.description')}
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
              id={`${id}-email`}
              name="email"
              label={t('reference:fields.email')}
              type="email"
              autoComplete="email"
              fullWidth
              disabled={pending}
              value={values.email}
              onChange={(event) => {
                change('email', event.target.value);
              }}
              error={Boolean(message('email'))}
              helperText={message('email') || t('reference:speakers.form.emailHint')}
            />
            <TextField
              id={`${id}-shortBio`}
              name="shortBio"
              label={t('reference:fields.shortBio')}
              multiline
              rows={5}
              fullWidth
              disabled={pending}
              value={values.shortBio}
              onChange={(event) => {
                change('shortBio', event.target.value);
              }}
              error={Boolean(message('shortBio'))}
              helperText={message('shortBio') || t('reference:lookups.descriptionHint')}
            />
          </ContentSection>
        </Stack>
      </Paper>
      <EditorAside
        label={t('reference:speakers.form.settings')}
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="contained"
              type="submit"
              aria-label={t('reference:speakers.actions.save')}
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              {t('reference:speakers.actions.save')}
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
              ? t('reference:speakers.form.assignmentHint')
              : t('reference:speakers.form.preservedHint')}
          </Typography>
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {t('common:summary')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {values.name.trim() || t('reference:speakers.form.untitled')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {values.email.trim() || t('reference:speakers.form.noEmailAddress')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialValues
              ? t('reference:speakers.form.editHint')
              : t('reference:speakers.form.createHint')}
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
