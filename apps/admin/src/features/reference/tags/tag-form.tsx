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
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({
    name: initialValues?.name ?? '',
    color: initialValues?.color ?? '#315ed0',
    active: initialValues?.active ?? true,
  });
  const [attempted, setAttempted] = useState(false);
  const errors = {
    name: textError(values.name, 100, 'Enter a tag name.'),
    color: /^#[0-9a-f]{6}$/i.test(values.color.trim())
      ? ''
      : 'Use a six-digit hex color, e.g. #315ed0.',
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
                  Request ID: {error.requestId}
                </Typography>
              )}
            </Alert>
          )}
          <Stack component="section" aria-labelledby={`${id}-details`} sx={{ gap: 3 }}>
            <Box>
              <Typography id={`${id}-details`} variant="h6" component="h2" sx={{ mb: 1 }}>
                Tag details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use a short name and a distinct color for each event label.
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
              id={`${id}-color`}
              name="color"
              label="Color"
              autoComplete="off"
              fullWidth
              disabled={pending}
              value={values.color}
              onChange={(event) => {
                change('color', event.target.value);
              }}
              error={Boolean(message('color'))}
              helperText={
                message('color') || 'Six-digit hex color. Select the swatch to choose a color.'
              }
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Box
                        component="input"
                        type="color"
                        aria-label="Choose tag color"
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
          </Stack>
        </Stack>
      </Paper>
      <EditorAside
        label="Tag settings"
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              aria-label="Save tag"
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              Save tag
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
              ? 'Available for assignment to events.'
              : 'Existing event tags are preserved. This tag cannot be newly assigned.'}
          </Typography>
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Summary
          </Typography>
          <Chip
            label={values.name.trim() || 'Untitled tag'}
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
              ? 'Save changes to this tag in the selected store.'
              : 'Create a new tag in the selected store.'}
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
