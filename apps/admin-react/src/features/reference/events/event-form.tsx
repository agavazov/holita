import { useFormat } from '../../../i18n/use-format.js';
import { eventInputInstant } from './event-time.js';
import { useTranslation } from 'react-i18next';
import { ContentSection } from '../../../components/content-section.js';
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
import type {
  CreateReferenceEventInput,
  ReferenceEventDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { RelationSelect } from '../relation-select.js';
import { DescriptionEditor } from './description-editor.js';
import { eventDraft, eventInput, validateEventDraft, type EventField } from './event-form-state.js';
import { eventFormats, eventStatuses } from './event-list-state.js';

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
  const { t } = useTranslation(['validation', 'reference', 'common']);
  const format = useFormat();
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
      error?.fieldErrors.find(({ path }) => path === field)?.message ||
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
      aria-label={t('reference:events.form.label')}
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
              {error.message}
              {error.requestId && (
                <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                  {t('common:requestId', { id: error.requestId })}
                </Typography>
              )}
            </Alert>
          )}
          <Box
            component="section"
            hidden={tab !== 'general'}
            aria-label={t('reference:events.tabs.general')}
          >
            <ContentSection
              title={t('reference:events.form.essentials')}
              description={t('reference:events.form.essentialsHint')}
            >
              <TextField
                {...input('title')}
                label={t('reference:fields.title')}
                autoFocus
                autoComplete="off"
                value={values.title}
                onChange={(event) => {
                  change('title', event.target.value);
                }}
              />
              <TextField
                {...input('code')}
                label={t('reference:fields.code')}
                autoComplete="off"
                value={values.code}
                onChange={(event) => {
                  change('code', event.target.value);
                }}
                helperText={message('code') || t('reference:events.form.codeHint')}
                slotProps={{ input: { readOnly: Boolean(initialValues) } }}
              />
              <TextField
                {...input('format')}
                select
                label={t('reference:fields.format')}
                value={values.format}
                onChange={(event) => {
                  const format = eventFormats.find((value) => value === event.target.value);
                  if (format) change('format', format);
                }}
              >
                {eventFormats.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`reference:events.format.${value}`)}
                  </MenuItem>
                ))}
              </TextField>
            </ContentSection>
          </Box>
          <Box
            component="section"
            hidden={tab !== 'schedule'}
            aria-label={t('reference:events.tabs.scheduleAria')}
          >
            <ContentSection
              title={t('reference:events.tabs.schedule')}
              description={t('reference:events.form.scheduleHint')}
            >
              <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2 }}>
                <TextField
                  {...input('startsAt')}
                  label={t('reference:fields.startsAt')}
                  type="datetime-local"
                  value={values.startsAt}
                  onChange={(event) => {
                    change('startsAt', event.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  {...input('endsAt')}
                  label={t('reference:fields.endsAt')}
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
                  label={t('reference:fields.registrationOpens')}
                  type="date"
                  value={values.registrationOpensOn}
                  onChange={(event) => {
                    change('registrationOpensOn', event.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  {...input('registrationClosesOn')}
                  label={t('reference:fields.registrationCloses')}
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
                  label={t('reference:fields.venue')}
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
                  label={t('reference:fields.meetingUrl')}
                  placeholder="https://"
                  value={values.meetingUrl}
                  onChange={(event) => {
                    change('meetingUrl', event.target.value);
                  }}
                />
              )}
              <RelationSelect
                {...input('tagIds')}
                label={t('reference:tags.title')}
                resource={tagsResource(storeId)}
                multiple
                value={values.tagIds}
                onChange={(value) => {
                  change('tagIds', Array.isArray(value) ? value : []);
                }}
              />
            </ContentSection>
          </Box>
          <Box
            component="section"
            hidden={tab !== 'content'}
            aria-label={t('reference:events.tabs.content')}
          >
            <ContentSection
              title={t('reference:events.form.content')}
              description={t('reference:events.form.contentHint')}
            >
              <TextField
                {...input('summary')}
                label={t('common:summary')}
                multiline
                rows={5}
                value={values.summary}
                onChange={(event) => {
                  change('summary', event.target.value);
                }}
                helperText={message('summary') || t('reference:events.form.summaryHint')}
              />
              <Box>
                <Typography
                  component="label"
                  htmlFor={`${id}-descriptionHtml`}
                  variant="subtitle2"
                  sx={{ display: 'block', mb: 1 }}
                >
                  {t('reference:fields.description')}
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
                  {message('descriptionHtml') || t('reference:events.form.descriptionHint')}
                </FormHelperText>
              </Box>
              {gallery}
            </ContentSection>
          </Box>
        </Stack>
      </Paper>
      <EditorAside
        label={t('reference:events.form.settings')}
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="contained"
              type="submit"
              disabled={saveDisabled}
              aria-label={t('reference:events.actions.save')}
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              {t('reference:events.actions.save')}
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            {t('common:status.label')}
          </Typography>
          <TextField
            {...input('status')}
            select
            label={t('common:status.label')}
            value={values.status}
            onChange={(event) => {
              const status = eventStatuses.find((value) => value === event.target.value);
              if (status) change('status', status);
            }}
          >
            {eventStatuses.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`reference:events.status.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            label={t('reference:fields.featured')}
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
            {t('reference:events.form.settings')}
          </Typography>
          <TextField
            {...input('capacity')}
            label={t('reference:fields.capacity')}
            type="number"
            value={values.capacity}
            onChange={(event) => {
              change('capacity', event.target.value);
            }}
            helperText={message('capacity') || t('reference:lookups.capacityHint')}
            slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
          />
          <TextField
            {...input('budget')}
            label={t('reference:fields.budgetEur')}
            value={values.budget}
            onChange={(event) => {
              change('budget', event.target.value);
            }}
            helperText={message('budget') || t('reference:events.form.budgetHint')}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {t('common:summary')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {values.title.trim() || t('reference:events.form.untitled')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`reference:events.format.${values.format}`)} ·{' '}
            {t(`reference:events.status.${values.status}`)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {values.startsAt && !errors.startsAt
              ? `${format.dateTime(eventInputInstant(values.startsAt, initialValues?.startsAt, t))} (${t('reference:timezone')})`
              : t('reference:events.form.noStart')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialValues
              ? t('reference:events.form.editHint')
              : t('reference:events.form.createHint')}
          </Typography>
          {saveDisabled && (
            <Alert severity="info">{t('reference:events.form.finishGallery')}</Alert>
          )}
        </Stack>
      </EditorAside>
    </Stack>
  );
}
