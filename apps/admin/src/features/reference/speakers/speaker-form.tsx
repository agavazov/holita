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

type SpeakerFormProps = {
  header?: ReactNode;
  initialValues?: CreateReferenceSpeakerInput | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateReferenceSpeakerInput) => void;
  onCancel: () => void;
  onChange: () => void;
};

function textError(value: string, max: number, requiredMessage = '') {
  if (!value.trim()) return requiredMessage;
  if (value.includes('\u0000')) return 'Remove unsupported characters.';
  return Array.from(value.trim()).length > max ? `Use at most ${String(max)} characters.` : '';
}

export function SpeakerForm({
  header,
  initialValues,
  pending,
  error,
  onSubmit,
  onCancel,
  onChange,
}: SpeakerFormProps) {
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
    name: textError(values.name, 200, 'Enter a speaker name.'),
    email:
      textError(values.email, 254) ||
      (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
        ? 'Enter a valid email address.'
        : ''),
    shortBio: textError(values.shortBio, 2000),
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
                  Request ID: {error.requestId}
                </Typography>
              )}
            </Alert>
          )}
          <Stack component="section" aria-labelledby={`${id}-details`} sx={{ gap: 3 }}>
            <Box>
              <Typography id={`${id}-details`} variant="h6" component="h2" sx={{ mb: 1 }}>
                Speaker details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Keep a reusable directory of people for your event program.
              </Typography>
            </Box>
            <TextField
              id={`${id}-name`}
              name="name"
              label="Name"
              autoFocus
              autoComplete="off"
              fullWidth
              disabled={pending}
              value={values.name}
              onChange={(event) => {
                change('name', event.target.value);
              }}
              error={Boolean(message('name'))}
              helperText={message('name') || 'Use the name people will recognize.'}
            />
            <TextField
              id={`${id}-email`}
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              fullWidth
              disabled={pending}
              value={values.email}
              onChange={(event) => {
                change('email', event.target.value);
              }}
              error={Boolean(message('email'))}
              helperText={message('email') || 'Optional. Contact email address.'}
            />
            <TextField
              id={`${id}-shortBio`}
              name="shortBio"
              label="Short biography"
              multiline
              rows={5}
              fullWidth
              disabled={pending}
              value={values.shortBio}
              onChange={(event) => {
                change('shortBio', event.target.value);
              }}
              error={Boolean(message('shortBio'))}
              helperText={message('shortBio') || 'Optional. Up to 2,000 characters.'}
            />
          </Stack>
        </Stack>
      </Paper>
      <EditorAside
        label="Speaker settings"
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              aria-label="Save speaker"
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              Save speaker
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            Status
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
            label="Active"
          />
          {message('active') && (
            <Typography variant="caption" color="error">
              {message('active')}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {values.active
              ? 'Available for assignment to sessions.'
              : 'Existing session assignments are preserved.'}
          </Typography>
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Summary
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {values.name.trim() || 'Untitled speaker'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {values.email.trim() || 'No email address'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialValues
              ? 'Save changes to this speaker in the selected store.'
              : 'Create a new speaker in the selected store.'}
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
