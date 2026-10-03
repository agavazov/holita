// Aurora CreateEvent composition with Speaker fields and validation.
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { EditorAside } from '../../../components/editor-aside.js';
import type { DataError } from '../../../data/data-provider.js';
import type { CreateReferenceSpeakerInput } from '../../../generated/graphql/operations.js';
import { textError } from '../text-validation.js';
import { useLocalization } from '../../../localization/localization-provider.js';

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
  const { t } = useLocalization();
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
    name: textError(values.name, 200, t('reference.speakerNameRequired')),
    email:
      textError(values.email, 254) ||
      (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
        ? t('reference.emailInvalid')
        : ''),
    shortBio: textError(values.shortBio, 2000),
    active: '',
  };
  function message(field: keyof typeof values) {
    return (
      (attempted && errors[field]) ||
      (error?.fieldErrors.some(({ path }) => path === field) ? t('common.genericError') : '') ||
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
              {t('common.genericError')}
              {error.requestId && (
                <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                  {t('common.requestId')}: {error.requestId}
                </Typography>
              )}
            </Alert>
          )}
          <Stack component="section" aria-labelledby={`${id}-details`} sx={{ gap: 3 }}>
            <Box>
              <Typography id={`${id}-details`} variant="h6" component="h2" sx={{ mb: 1 }}>
                {t('reference.speakerDetails')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('reference.speakerDetailsHelp')}
              </Typography>
            </Box>
            <TextField
              id={`${id}-name`}
              name="name"
              label={t('reference.name')}
              autoFocus
              autoComplete="off"
              fullWidth
              disabled={pending}
              value={values.name}
              onChange={(event) => {
                change('name', event.target.value);
              }}
              error={Boolean(message('name'))}
              helperText={message('name') || t('reference.nameHelp')}
            />
            <TextField
              id={`${id}-email`}
              name="email"
              label={t('reference.email')}
              type="email"
              autoComplete="email"
              fullWidth
              disabled={pending}
              value={values.email}
              onChange={(event) => {
                change('email', event.target.value);
              }}
              error={Boolean(message('email'))}
              helperText={message('email') || t('reference.emailHelp')}
            />
            <TextField
              id={`${id}-shortBio`}
              name="shortBio"
              label={t('reference.shortBiography')}
              multiline
              rows={5}
              fullWidth
              disabled={pending}
              value={values.shortBio}
              onChange={(event) => {
                change('shortBio', event.target.value);
              }}
              error={Boolean(message('shortBio'))}
              helperText={message('shortBio') || t('reference.optionalLongText')}
            />
          </Stack>
        </Stack>
      </Paper>
      <EditorAside
        label={t('reference.speakerSettings')}
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              {t('reference.cancel')}
            </Button>
            <Button
              variant="contained"
              type="submit"
              aria-label={t('reference.saveSpeaker')}
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              {t('reference.saveSpeaker')}
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            {t('reference.status')}
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
            label={t('reference.active')}
          />
          {message('active') && (
            <Typography variant="caption" color="error">
              {message('active')}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {values.active
              ? t('reference.speakerActiveHelp')
              : t('reference.speakerInactiveHelp')}
          </Typography>
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {t('reference.summary')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {values.name.trim() || t('reference.untitledSpeaker')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {values.email.trim() || t('reference.emailNotSet')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialValues
              ? t('reference.editSpeakerSummary')
              : t('reference.createSpeakerSummary')}
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
