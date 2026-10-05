import { useTranslation } from 'react-i18next';
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
export function FormExamples() {
  const { t } = useTranslation(['prototype', 'common', 'reference', 'validation']);
  const initialValues = {
    name: '',
    email: '',
    category: t('prototype:catalog.forms.accessories'),
    quantity: '1',
    notes: '',
    color: '#315ed0',
    active: true,
    notify: false,
    delivery: 'pickup',
    date: '2026-10-02',
    startsAt: '2026-10-02T10:00',
  };

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
      ? t('validation:catalog.name')
      : Array.from(values.name.trim()).length > 100
        ? t('validation:text.maxLength', { max: 100 })
        : '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
      ? ''
      : t('validation:reference.email'),
    quantity:
      Number.isSafeInteger(Number(values.quantity)) && Number(values.quantity) >= 1
        ? ''
        : t('validation:catalog.quantity'),
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
          label={t('prototype:catalog.forms.state')}
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
          <MenuItem value="ready">{t('prototype:catalog.states.ready')}</MenuItem>
          <MenuItem value="disabled">{t('prototype:catalog.states.disabled')}</MenuItem>
          <MenuItem value="saving">{t('prototype:catalog.states.saving')}</MenuItem>
          <MenuItem value="error">{t('prototype:catalog.states.saveError')}</MenuItem>
        </StyledTextField>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('prototype:catalog.forms.stateHint')}
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
            title={t('prototype:catalog.forms.controls')}
            description={t('prototype:catalog.forms.controlsHint')}
          >
            {state === 'error' && (
              <Alert severity="error">{t('prototype:catalog.forms.error')}</Alert>
            )}
            {saved && <Alert severity="success">{t('prototype:catalog.forms.saved')}</Alert>}
            <Box
              component="fieldset"
              disabled={disabled}
              sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}
            >
              <Stack sx={{ gap: 3 }}>
                <TextField
                  id={`${id}-name`}
                  label={t('reference:fields.name')}
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
                    attempted && errors.name ? errors.name : t('prototype:catalog.forms.nameHint')
                  }
                />
                <TextField
                  id={`${id}-email`}
                  label={t('prototype:catalog.forms.email')}
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
                      : t('prototype:catalog.forms.emailHint')
                  }
                />
                <TextField
                  id={`${id}-category`}
                  select
                  label={t('prototype:catalog.forms.category')}
                  value={values.category}
                  fullWidth
                  disabled={disabled}
                  onChange={(event) => {
                    change('category', event.target.value);
                  }}
                >
                  {[
                    t('prototype:catalog.forms.accessories'),
                    t('prototype:catalog.forms.home'),
                    t('prototype:catalog.forms.stationery'),
                  ].map((label) => (
                    <MenuItem key={label} value={label}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <Autocomplete
                  multiple
                  options={[
                    t('prototype:catalog.forms.new'),
                    t('reference:fields.featured'),
                    t('prototype:catalog.forms.seasonal'),
                    t('prototype:catalog.forms.limited'),
                  ]}
                  value={labels}
                  disabled={disabled}
                  onChange={(_event, next) => {
                    setLabels(next);
                    setSaved(false);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('prototype:catalog.forms.labels')}
                      helperText={t('prototype:catalog.forms.labelsHint')}
                    />
                  )}
                />
                <TextField
                  id={`${id}-quantity`}
                  label={t('prototype:catalog.forms.quantity')}
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
                    attempted && errors.quantity
                      ? errors.quantity
                      : t('prototype:catalog.forms.quantityHint')
                  }
                />
                <TextField
                  id={`${id}-notes`}
                  label={t('prototype:catalog.forms.notes')}
                  multiline
                  minRows={3}
                  fullWidth
                  value={values.notes}
                  disabled={disabled}
                  onChange={(event) => {
                    change('notes', event.target.value);
                  }}
                  helperText={t('prototype:catalog.forms.notesHint')}
                />
                <StyledTextField
                  id={`${id}-date`}
                  label={t('prototype:catalog.forms.date')}
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
                  label={t('prototype:catalog.forms.dateTime')}
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
                  label={t('reference:fields.color')}
                  type="color"
                  value={values.color}
                  disabled={disabled}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  onChange={(event) => {
                    change('color', event.target.value);
                  }}
                  helperText={t('prototype:catalog.forms.colorHint')}
                />
                <TextField
                  id={`${id}-readonly`}
                  label={t('prototype:catalog.forms.recordId')}
                  value="EXAMPLE-001"
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                  disabled={disabled}
                  helperText={t('prototype:catalog.forms.readonlyHint')}
                />
                <FormControl disabled={disabled}>
                  <FormLabel id={`${id}-delivery`}>
                    {t('prototype:catalog.forms.delivery')}
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby={`${id}-delivery`}
                    value={values.delivery}
                    onChange={(event) => {
                      change('delivery', event.target.value);
                    }}
                    row
                  >
                    <FormControlLabel
                      value="pickup"
                      control={<Radio />}
                      label={t('prototype:catalog.forms.pickup')}
                    />
                    <FormControlLabel
                      value="shipping"
                      control={<Radio />}
                      label={t('prototype:catalog.forms.shipping')}
                    />
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
                  label={t('prototype:catalog.forms.notify')}
                />
              </Stack>
            </Box>
          </ContentSection>
        </Paper>
        <EditorAside
          label={t('prototype:catalog.forms.settingsLabel')}
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
                {t('prototype:catalog.forms.reset')}
              </Button>
              <Button
                type="submit"
                variant="contained"
                loading={state === 'saving'}
                disabled={state === 'disabled'}
                sx={{ flex: 1 }}
              >
                {t('prototype:catalog.forms.save')}
              </Button>
            </>
          }
        >
          <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 3 }}>
            <Typography variant="h6" component="h2">
              {t('prototype:catalog.forms.settings')}
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
              label={t('common:status.active')}
            />
            <Chip
              label={values.active ? t('common:status.active') : t('reference:events.status.DRAFT')}
              color={values.active ? 'success' : 'neutral'}
              variant="soft"
              sx={{ alignSelf: 'flex-start' }}
            />
          </Stack>
          <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
            <Typography variant="h6" component="h2">
              {t('common:summary')}
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {values.name.trim() || t('prototype:catalog.forms.untitled')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('prototype:catalog.forms.categorySummary', { category: values.category })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('prototype:catalog.forms.labelsSummary', { count: labels.length })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('prototype:catalog.forms.mobileHint')}
            </Typography>
          </Stack>
        </EditorAside>
      </Stack>
    </Stack>
  );
}
