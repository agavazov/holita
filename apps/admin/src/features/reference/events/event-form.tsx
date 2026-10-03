// Aurora CreateEvent composition; Refine mutations and route lifecycle remain in the editor.
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { EditorAside } from '../../../components/editor-aside.js';
import { tagsResource, venuesResource, type DataError } from '../../../data/data-provider.js';
import { useLocalization } from '../../../localization/localization-provider.js';
import type {
  CreateReferenceEventInput,
  ReferenceEventDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { RelationSelect } from '../relation-select.js';
import { DescriptionEditor } from './description-editor.js';
import { eventDraft, eventInput, validateEventDraft, type EventField } from './event-form-state.js';
import { eventFormats, eventStatuses } from './event-list-state.js';
import { localizedErrorMessage, localizedFieldError } from '../../../localization/data-error.js';

type Props = {
  storeId: string;
  header?: ReactNode;
  initialValues?: ReferenceEventDetailsFragment | undefined;
  pending: boolean;
  gallery?: ReactNode;
  saveDisabled?: boolean;
  error: DataError | null;
  tab: string;
  onTabChange: (tab: string) => void;
  onSubmit: (values: CreateReferenceEventInput) => void;
  onCancel: () => void;
  onChange: () => void;
};
const scheduleFields = [
  'startsAt',
  'endsAt',
  'registrationOpensOn',
  'registrationClosesOn',
  'venueId',
  'meetingUrl',
  'tagIds',
];
export function EventForm({
  storeId,
  header,
  initialValues: loadedValues,
  pending,
  gallery,
  saveDisabled = false,
  error,
  tab,
  onTabChange,
  onSubmit,
  onCancel,
  onChange,
}: Props) {
  const { t } = useLocalization();
  const id = useId();
  // The draft and its stored time offsets belong to the same initial record snapshot.
  const [initialValues] = useState(loadedValues);
  const description = useRef<{ focus: () => void }>(null);
  const [values, setValues] = useState(() => eventDraft(initialValues));
  const [attempted, setAttempted] = useState(false);
  const errors = validateEventDraft(values, initialValues, t);
  const focusField = useCallback(
    (name: string) => {
      onTabChange(
        scheduleFields.includes(name)
          ? 'schedule'
          : ['summary', 'descriptionHtml'].includes(name)
            ? 'content'
            : 'general',
      );
      const frame = requestAnimationFrame(() => {
        if (name === 'descriptionHtml') description.current?.focus();
        else {
          const input = document.getElementById(`${id}-${name}`);
          if (input instanceof HTMLElement) input.focus();
        }
      });
      return () => {
        cancelAnimationFrame(frame);
      };
    },
    [id, onTabChange],
  );
  useEffect(() => {
    const first = error?.fieldErrors.find(({ path }) => Object.hasOwn(eventDraft(), path));
    if (first) return focusField(first.path);
    return undefined;
  }, [error, focusField]);
  function message(field: EventField) {
    return (
      (attempted && errors[field]) ||
      localizedFieldError(error?.fieldErrors.find(({ path }) => path === field), t) ||
      ''
    );
  }
  function change<Field extends EventField>(field: Field, value: (typeof values)[Field]) {
    setValues({ ...values, [field]: value });
    onChange();
  }
  function input(field: EventField) {
    return {
      id: `${id}-${field}`,
      name: field,
      disabled: pending,
      error: Boolean(message(field)),
      helperText: message(field),
      fullWidth: true,
    };
  }
  return (
    <Stack
      component="form"
      aria-label={t('reference.events.form')}
      noValidate
      direction={{ xs: 'column', md: 'row' }}
      sx={{ flex: 1, minWidth: 0 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || saveDisabled) return;
        setAttempted(true);
        const first = Object.entries(errors).find(([, value]) => value);
        if (first) {
          focusField(first[0]);
          return;
        }
        onSubmit(eventInput(values, initialValues));
      }}
    >
      <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1, minWidth: 0 }}>
        {header}
        <Stack sx={{ gap: 4, maxWidth: 520, mx: 'auto' }}>
          {error && (
            <Alert severity="error">
              {localizedErrorMessage(error, t)}
              {error.requestId && (
                <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                  {t('common.requestId')}: {error.requestId}
                </Typography>
              )}
            </Alert>
          )}
          <Box component="section" hidden={tab !== 'general'} aria-label={t('reference.events.general')}>
            <Stack sx={{ gap: 3 }}>
              <Box>
                <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                  {t('reference.events.essentials')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('reference.events.essentialsHelp')}
                </Typography>
              </Box>
              <TextField
                {...input('title')}
                label={t('reference.events.fieldTitle')}
                autoFocus
                autoComplete="off"
                value={values.title}
                onChange={(event) => {
                  change('title', event.target.value);
                }}
              />
              <TextField
                {...input('code')}
                label={t('reference.events.fieldCode')}
                autoComplete="off"
                value={values.code}
                onChange={(event) => {
                  change('code', event.target.value);
                }}
                helperText={message('code') || t('reference.events.codeHelp')}
                slotProps={{ input: { readOnly: Boolean(initialValues) } }}
              />
              <TextField
                {...input('format')}
                select
                label={t('reference.events.fieldFormat')}
                value={values.format}
                onChange={(event) => {
                  const format = eventFormats.find(({ value }) => value === event.target.value);
                  if (format) change('format', format.value);
                }}
              >
                {eventFormats.map(({ value, labelKey }) => (
                  <MenuItem key={value} value={value}>
                    {t(labelKey)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Box>
          <Box component="section" hidden={tab !== 'schedule'} aria-label={t('reference.events.scheduleLocation')}>
            <Stack sx={{ gap: 3 }}>
              <Box>
                <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                  {t('reference.events.scheduleLocation')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('reference.events.scheduleHelp')}
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2 }}>
                <TextField
                  {...input('startsAt')}
                  label={t('reference.events.startsAt')}
                  type="datetime-local"
                  value={values.startsAt}
                  onChange={(event) => {
                    change('startsAt', event.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  {...input('endsAt')}
                  label={t('reference.events.endsAt')}
                  type="datetime-local"
                  value={values.endsAt}
                  onChange={(event) => {
                    change('endsAt', event.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
              <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2 }}>
                <TextField
                  {...input('registrationOpensOn')}
                  label={t('reference.events.fieldRegistrationOpens')}
                  type="date"
                  value={values.registrationOpensOn}
                  onChange={(event) => {
                    change('registrationOpensOn', event.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  {...input('registrationClosesOn')}
                  label={t('reference.events.fieldRegistrationCloses')}
                  type="date"
                  value={values.registrationClosesOn}
                  onChange={(event) => {
                    change('registrationClosesOn', event.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
              {values.format !== 'ONLINE' && (
                <RelationSelect
                  {...input('venueId')}
                  label={t('reference.events.fieldVenue')}
                  resource={venuesResource(storeId)}
                  value={values.venueId}
                  onChange={(value) => {
                    change('venueId', typeof value === 'string' ? value : '');
                  }}
                />
              )}
              {values.format !== 'IN_PERSON' && (
                <TextField
                  {...input('meetingUrl')}
                  label={t('reference.events.fieldMeetingUrl')}
                  placeholder="https://"
                  value={values.meetingUrl}
                  onChange={(event) => {
                    change('meetingUrl', event.target.value);
                  }}
                />
              )}
              <RelationSelect
                {...input('tagIds')}
                label={t('reference.events.fieldTags')}
                resource={tagsResource(storeId)}
                multiple
                value={values.tagIds}
                onChange={(value) => {
                  change('tagIds', Array.isArray(value) ? value : []);
                }}
              />
            </Stack>
          </Box>
          <Box component="section" hidden={tab !== 'content'} aria-label={t('reference.events.contentMedia')}>
            <Stack sx={{ gap: 3 }}>
              <Box>
                <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                  {t('reference.events.content')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('reference.events.contentHelp')}
                </Typography>
              </Box>
              <TextField
                {...input('summary')}
                label={t('reference.events.fieldSummary')}
                multiline
                rows={5}
                value={values.summary}
                onChange={(event) => {
                  change('summary', event.target.value);
                }}
                helperText={message('summary') || t('reference.events.summaryHelp')}
              />
              <Box>
                <Typography
                  component="label"
                  htmlFor={`${id}-descriptionHtml`}
                  variant="subtitle2"
                  sx={{ display: 'block', mb: 1 }}
                >
                  {t('reference.events.description')}
                </Typography>
                <DescriptionEditor
                  id={`${id}-descriptionHtml`}
                  ref={description}
                  value={values.descriptionHtml}
                  onChange={(value) => {
                    change('descriptionHtml', value ?? '');
                  }}
                  disabled={pending}
                  error={Boolean(message('descriptionHtml'))}
                  aria-describedby={`${id}-description-help`}
                />
                <FormHelperText
                  id={`${id}-description-help`}
                  error={Boolean(message('descriptionHtml'))}
                >
                  {message('descriptionHtml') ||
                    t('reference.events.descriptionHelp')}
                </FormHelperText>
              </Box>
              {gallery}
            </Stack>
          </Box>
        </Stack>
      </Paper>
      <EditorAside
        label={t('reference.events.settings')}
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              {t('reference.cancel')}
            </Button>
            <Button
              variant="contained"
              type="submit"
              disabled={saveDisabled}
              aria-label={t('reference.events.save')}
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              {t('reference.events.save')}
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            {t('reference.events.fieldStatus')}
          </Typography>
          <TextField
            {...input('status')}
            select
            label={t('reference.events.fieldStatus')}
            value={values.status}
            onChange={(event) => {
              const status = eventStatuses.find(({ value }) => value === event.target.value);
              if (status) change('status', status.value);
            }}
          >
            {eventStatuses.map(({ value, labelKey }) => (
              <MenuItem key={value} value={value}>
                {t(labelKey)}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            label={t('reference.events.featured')}
            control={
              <Switch
                name="featured"
                checked={values.featured}
                disabled={pending}
                onChange={(_, checked) => {
                  change('featured', checked);
                }}
                slotProps={{ input: { role: 'switch' } }}
              />
            }
          />
          {message('featured') && <FormHelperText error>{message('featured')}</FormHelperText>}
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 3 }}>
          <Typography variant="h6" component="h2">
            {t('reference.events.settings')}
          </Typography>
          <TextField
            {...input('capacity')}
            label={t('reference.events.fieldCapacity')}
            type="number"
            value={values.capacity}
            onChange={(event) => {
              change('capacity', event.target.value);
            }}
            helperText={message('capacity') || t('reference.events.capacityHelp')}
            slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
          />
          <TextField
            {...input('budget')}
            label={t('reference.events.fieldBudget')}
            value={values.budget}
            onChange={(event) => {
              change('budget', event.target.value);
            }}
            helperText={message('budget') || t('reference.events.budgetHelp')}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {t('reference.events.summaryPanel')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {values.title.trim() || t('reference.events.untitled')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(eventFormats.find(({ value }) => value === values.format)?.labelKey ?? 'reference.events.formatInPerson')} ·{' '}
            {t(eventStatuses.find(({ value }) => value === values.status)?.labelKey ?? 'reference.events.statusDraft')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {values.startsAt
              ? t('reference.events.sofiaValue', { value: values.startsAt.replace('T', ' ') })
              : t('reference.events.startNotSet')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialValues
              ? t('reference.events.saveHelp')
              : t('reference.events.createStoreHelp')}
          </Typography>
          {saveDisabled && (
            <Alert severity="info">
              {t('reference.events.finishGallery')}
            </Alert>
          )}
        </Stack>
      </EditorAside>
    </Stack>
  );
}
