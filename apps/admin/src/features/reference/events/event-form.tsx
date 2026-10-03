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
  const id = useId();
  // The draft and its stored time offsets belong to the same initial record snapshot.
  const [initialValues] = useState(loadedValues);
  const description = useRef<{ focus: () => void }>(null);
  const [values, setValues] = useState(() => eventDraft(initialValues));
  const [attempted, setAttempted] = useState(false);
  const errors = validateEventDraft(values, initialValues);
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
      aria-label="Event form"
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
                  Request ID: {error.requestId}
                </Typography>
              )}
            </Alert>
          )}
          <Box component="section" hidden={tab !== 'general'} aria-label="General">
            <ContentSection
              title="Event essentials"
              description="Give your event a clear identity and choose how people will attend."
            >
              <TextField
                {...input('title')}
                label="Title"
                autoFocus
                autoComplete="off"
                value={values.title}
                onChange={(event) => {
                  change('title', event.target.value);
                }}
              />
              <TextField
                {...input('code')}
                label="Code"
                autoComplete="off"
                value={values.code}
                onChange={(event) => {
                  change('code', event.target.value);
                }}
                helperText={message('code') || 'Unique in this store. Fixed after creation.'}
                slotProps={{ input: { readOnly: Boolean(initialValues) } }}
              />
              <TextField
                {...input('format')}
                select
                label="Format"
                value={values.format}
                onChange={(event) => {
                  const format = eventFormats.find(({ value }) => value === event.target.value);
                  if (format) change('format', format.value);
                }}
              >
                {eventFormats.map(({ value, label }) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </ContentSection>
          </Box>
          <Box component="section" hidden={tab !== 'schedule'} aria-label="Schedule and location">
            <ContentSection
              title="Schedule & location"
              description="All event times are in Europe/Sofia. Registration dates are calendar dates."
            >
              <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2 }}>
                <TextField
                  {...input('startsAt')}
                  label="Starts at"
                  type="datetime-local"
                  value={values.startsAt}
                  onChange={(event) => {
                    change('startsAt', event.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  {...input('endsAt')}
                  label="Ends at"
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
                  label="Registration opens"
                  type="date"
                  value={values.registrationOpensOn}
                  onChange={(event) => {
                    change('registrationOpensOn', event.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  {...input('registrationClosesOn')}
                  label="Registration closes"
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
                  label="Venue"
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
                  label="Meeting URL"
                  placeholder="https://"
                  value={values.meetingUrl}
                  onChange={(event) => {
                    change('meetingUrl', event.target.value);
                  }}
                />
              )}
              <RelationSelect
                {...input('tagIds')}
                label="Tags"
                resource={tagsResource(storeId)}
                multiple
                value={values.tagIds}
                onChange={(value) => {
                  change('tagIds', Array.isArray(value) ? value : []);
                }}
              />
            </ContentSection>
          </Box>
          <Box component="section" hidden={tab !== 'content'} aria-label="Content">
            <ContentSection
              title="Event content"
              description="A short introduction that helps people understand the event."
            >
              <TextField
                {...input('summary')}
                label="Summary"
                multiline
                rows={5}
                value={values.summary}
                onChange={(event) => {
                  change('summary', event.target.value);
                }}
                helperText={message('summary') || 'Optional. Up to 500 characters.'}
              />
              <Box>
                <Typography
                  component="label"
                  htmlFor={`${id}-descriptionHtml`}
                  variant="subtitle2"
                  sx={{ display: 'block', mb: 1 }}
                >
                  Description
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
                    'Add headings, emphasis, lists and web links. Formatting is saved with the event.'}
                </FormHelperText>
              </Box>
              {gallery}
            </ContentSection>
          </Box>
        </Stack>
      </Paper>
      <EditorAside
        label="Event settings"
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              disabled={saveDisabled}
              aria-label="Save event"
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              Save event
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            Status
          </Typography>
          <TextField
            {...input('status')}
            select
            label="Status"
            value={values.status}
            onChange={(event) => {
              const status = eventStatuses.find(({ value }) => value === event.target.value);
              if (status) change('status', status.value);
            }}
          >
            {eventStatuses.map(({ value, label }) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            label="Featured"
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
            Event settings
          </Typography>
          <TextField
            {...input('capacity')}
            label="Capacity"
            type="number"
            value={values.capacity}
            onChange={(event) => {
              change('capacity', event.target.value);
            }}
            helperText={message('capacity') || 'Optional. Maximum number of people.'}
            slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
          />
          <TextField
            {...input('budget')}
            label="Budget (EUR)"
            value={values.budget}
            onChange={(event) => {
              change('budget', event.target.value);
            }}
            helperText={message('budget') || 'Optional. Up to two decimal places.'}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Summary
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {values.title.trim() || 'Untitled event'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {eventFormats.find(({ value }) => value === values.format)?.label} ·{' '}
            {eventStatuses.find(({ value }) => value === values.status)?.label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {values.startsAt
              ? `${values.startsAt.replace('T', ' ')} (Sofia)`
              : 'Start date not set'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialValues
              ? 'Save changes to this event in the selected store.'
              : 'Create a new event in the selected store.'}
          </Typography>
          {saveDisabled && (
            <Alert severity="info">
              Finish or cancel your gallery changes before saving the event.
            </Alert>
          )}
        </Stack>
      </EditorAside>
    </Stack>
  );
}
