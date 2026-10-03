import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useId, useRef, useState } from 'react';
import { ContentSection } from '../../../components/content-section.js';
import { EditorAside } from '../../../components/editor-aside.js';
import StyledTextField from '../../../layout/primitives/styled-text-field.js';

const formStates = ['ready', 'disabled', 'saving', 'error'] as const;
type FormState = (typeof formStates)[number];
const initialValues = {
  name: '',
  email: '',
  category: 'Accessories',
  quantity: '1',
  notes: '',
  color: '#315ed0',
  active: true,
  notify: false,
  delivery: 'pickup',
  date: '2026-10-02',
  startsAt: '2026-10-02T10:00',
};

export function FormExamples() {
  const id = useId();
  const [values, setValues] = useState(initialValues);
  const [labels, setLabels] = useState<string[]>([]);
  const [state, setState] = useState<FormState>('ready');
  const [attempted, setAttempted] = useState(false);
  const [saved, setSaved] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const quantityInput = useRef<HTMLInputElement>(null);
  const disabled = state === 'disabled' || state === 'saving';
  const errors = {
    name: !values.name.trim()
      ? 'Enter a name.'
      : Array.from(values.name.trim()).length > 100
        ? 'Use at most 100 characters.'
        : '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
      ? ''
      : 'Enter a valid email address.',
    quantity:
      Number.isSafeInteger(Number(values.quantity)) && Number(values.quantity) >= 1
        ? ''
        : 'Enter a whole number of at least 1.',
  };
  function change<Field extends keyof typeof initialValues>(
    field: Field,
    value: (typeof initialValues)[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }
  return (
    <Stack sx={{ minWidth: 0 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <StyledTextField
          select
          label="Form state"
          value={state}
          sx={{ width: { xs: '100%', sm: 260 } }}
          onChange={(event) => {
            const next = formStates.find((value) => value === event.target.value);
            if (next) {
              setState(next);
              setSaved(false);
            }
          }}
        >
          <MenuItem value="ready">Ready</MenuItem>
          <MenuItem value="disabled">Disabled</MenuItem>
          <MenuItem value="saving">Saving</MenuItem>
          <MenuItem value="error">Save error</MenuItem>
        </StyledTextField>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Change the state to preview pending controls and errors. Save validates this example
          without sending a request.
        </Typography>
      </Paper>
      <Stack
        component="form"
        noValidate
        direction={{ md: 'row' }}
        sx={{ minWidth: 0 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled) return;
          setAttempted(true);
          const input = errors.name
            ? nameInput
            : errors.email
              ? emailInput
              : errors.quantity
                ? quantityInput
                : null;
          if (input) {
            input.current?.focus();
            return;
          }
          setState('ready');
          setSaved(true);
        }}
      >
        <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1, minWidth: 0 }}>
          <ContentSection
            title="Form controls"
            description="Labels, hints, errors and required markers stay with their fields. Settings and actions use the shared EditorAside."
          >
            {state === 'error' && (
              <Alert severity="error">
                The example could not be saved. Your entered values are preserved; try Save example
                again.
              </Alert>
            )}
            {saved && (
              <Alert severity="success">
                Example saved on this page. No prototype records were changed.
              </Alert>
            )}
            <Box
              component="fieldset"
              disabled={disabled}
              sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}
            >
              <Stack sx={{ gap: 3 }}>
                <TextField
                  id={`${id}-name`}
                  label="Name"
                  fullWidth
                  required
                  value={values.name}
                  inputRef={nameInput}
                  disabled={disabled}
                  onChange={(event) => {
                    change('name', event.target.value);
                  }}
                  error={attempted && Boolean(errors.name)}
                  helperText={
                    attempted && errors.name ? errors.name : 'Required · Up to 100 characters.'
                  }
                />
                <TextField
                  id={`${id}-email`}
                  label="Contact email"
                  type="email"
                  fullWidth
                  required
                  value={values.email}
                  inputRef={emailInput}
                  disabled={disabled}
                  onChange={(event) => {
                    change('email', event.target.value);
                  }}
                  error={attempted && Boolean(errors.email)}
                  helperText={
                    attempted && errors.email
                      ? errors.email
                      : 'Used here to demonstrate an email field.'
                  }
                />
                <TextField
                  id={`${id}-category`}
                  select
                  label="Category"
                  value={values.category}
                  fullWidth
                  disabled={disabled}
                  onChange={(event) => {
                    change('category', event.target.value);
                  }}
                >
                  {['Accessories', 'Home', 'Stationery'].map((label) => (
                    <MenuItem key={label} value={label}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <Autocomplete
                  multiple
                  options={['New', 'Featured', 'Seasonal', 'Limited']}
                  value={labels}
                  disabled={disabled}
                  onChange={(_event, next) => {
                    setLabels(next);
                    setSaved(false);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Labels"
                      helperText="Search and select several options."
                    />
                  )}
                />
                <TextField
                  id={`${id}-quantity`}
                  label="Quantity"
                  type="number"
                  fullWidth
                  value={values.quantity}
                  inputRef={quantityInput}
                  disabled={disabled}
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                  onChange={(event) => {
                    change('quantity', event.target.value);
                  }}
                  error={attempted && Boolean(errors.quantity)}
                  helperText={
                    attempted && errors.quantity ? errors.quantity : 'Whole numbers · Minimum 1.'
                  }
                />
                <TextField
                  id={`${id}-notes`}
                  label="Notes"
                  multiline
                  minRows={3}
                  fullWidth
                  value={values.notes}
                  disabled={disabled}
                  onChange={(event) => {
                    change('notes', event.target.value);
                  }}
                  helperText="Multiline content with a hint."
                />
                <StyledTextField
                  id={`${id}-date`}
                  label="Date"
                  type="date"
                  value={values.date}
                  fullWidth
                  disabled={disabled}
                  onChange={(event) => {
                    change('date', event.target.value);
                  }}
                />
                <StyledTextField
                  id={`${id}-starts`}
                  label="Date and time"
                  type="datetime-local"
                  value={values.startsAt}
                  fullWidth
                  disabled={disabled}
                  onChange={(event) => {
                    change('startsAt', event.target.value);
                  }}
                />
                <TextField
                  id={`${id}-color`}
                  label="Color"
                  type="color"
                  value={values.color}
                  disabled={disabled}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  onChange={(event) => {
                    change('color', event.target.value);
                  }}
                  helperText="Native color selection."
                />
                <TextField
                  id={`${id}-readonly`}
                  label="Record ID"
                  value="EXAMPLE-001"
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                  disabled={disabled}
                  helperText="Readonly values can be selected and copied."
                />
                <FormControl disabled={disabled}>
                  <FormLabel id={`${id}-delivery`}>Delivery</FormLabel>
                  <RadioGroup
                    aria-labelledby={`${id}-delivery`}
                    value={values.delivery}
                    onChange={(event) => {
                      change('delivery', event.target.value);
                    }}
                    row
                  >
                    <FormControlLabel value="pickup" control={<Radio />} label="Pickup" />
                    <FormControlLabel value="shipping" control={<Radio />} label="Shipping" />
                  </RadioGroup>
                </FormControl>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={values.notify}
                      disabled={disabled}
                      onChange={(_event, checked) => {
                        change('notify', checked);
                      }}
                    />
                  }
                  label="Notify the owner"
                />
              </Stack>
            </Box>
          </ContentSection>
        </Paper>
        <EditorAside
          label="Catalog form settings"
          actions={
            <>
              <Button
                color="neutral"
                variant="soft"
                disabled={state === 'saving'}
                onClick={() => {
                  setValues(initialValues);
                  setLabels([]);
                  setAttempted(false);
                  setSaved(false);
                  setState('ready');
                }}
              >
                Reset form
              </Button>
              <Button
                type="submit"
                variant="contained"
                loading={state === 'saving'}
                disabled={state === 'disabled'}
                sx={{ flex: 1 }}
              >
                Save example
              </Button>
            </>
          }
        >
          <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 3 }}>
            <Typography variant="h6" component="h2">
              Settings
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={values.active}
                  disabled={disabled}
                  onChange={(_event, checked) => {
                    change('active', checked);
                  }}
                />
              }
              label="Active"
            />
            <Chip
              label={values.active ? 'Active' : 'Draft'}
              color={values.active ? 'success' : 'neutral'}
              variant="soft"
              sx={{ alignSelf: 'flex-start' }}
            />
          </Stack>
          <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
            <Typography variant="h6" component="h2">
              Summary
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {values.name.trim() || 'Untitled example'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Category: {values.category}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Labels: {labels.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Actions and settings move below the fields on mobile.
            </Typography>
          </Stack>
        </EditorAside>
      </Stack>
    </Stack>
  );
}
