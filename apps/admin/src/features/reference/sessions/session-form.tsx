import { ContentSection } from '../../../components/content-section.js';
// Aurora Create Event composition with Session-owned fields and validation.
import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { EditorAside } from '../../../components/editor-aside.js';
import { speakersResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceSessionInput,
  ReferenceEventDetailsFragment,
  ReferenceSessionDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { RelationSelect } from '../relation-select.js';
import { eventInputInstant, eventTime } from '../events/event-time.js';

export function SessionForm({
  storeId,
  event,
  initialValues,
  header,
  pending,
  error,
  onSubmit,
  onCancel,
  onChange,
}: {
  storeId: string;
  event: ReferenceEventDetailsFragment;
  initialValues: ReferenceSessionDetailsFragment | undefined;
  header: ReactNode;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateReferenceSessionInput) => void;
  onCancel: () => void;
  onChange: () => void;
}) {
  const id = useId();
  const [original] = useState(initialValues ?? { startsAt: event.startsAt, endsAt: '' });
  const [values, setValues] = useState(() => ({
    title: initialValues?.title ?? '',
    summary: initialValues?.summary ?? '',
    room: initialValues?.room ?? '',
    startsAt: eventTime(original.startsAt).format('YYYY-MM-DDTHH:mm'),
    endsAt: original.endsAt ? eventTime(original.endsAt).format('YYYY-MM-DDTHH:mm') : '',
    speakerIds: initialValues?.speakerIds ?? [],
  }));
  type Field = keyof typeof values;
  const [attempted, setAttempted] = useState(false);
  const errors: Record<Field, string> = {
    title: '',
    summary: '',
    room: '',
    startsAt: '',
    endsAt: '',
    speakerIds: '',
  };
  for (const [field, max] of [
    ['title', 200],
    ['summary', 2000],
    ['room', 120],
  ] as const) {
    if (values[field].includes('\u0000')) errors[field] = 'Remove unsupported characters.';
    else if (Array.from(values[field].trim()).length > max)
      errors[field] = `Use at most ${String(max)} characters.`;
  }
  if (!values.title.trim()) errors.title = 'Enter a title of up to 200 characters.';
  for (const field of ['startsAt', 'endsAt'] as const) {
    try {
      const time = eventInputInstant(values[field], original[field]);
      if (
        Date.parse(time) < Date.parse(event.startsAt) ||
        Date.parse(time) > Date.parse(event.endsAt)
      )
        errors[field] = 'Choose a time within the event.';
    } catch (failure) {
      errors[field] = failure instanceof Error ? failure.message : 'Choose a valid date and time.';
    }
  }
  if (
    !errors.startsAt &&
    !errors.endsAt &&
    eventInputInstant(values.endsAt, original.endsAt) <=
      eventInputInstant(values.startsAt, original.startsAt)
  )
    errors.endsAt = 'End must be after start.';
  if (values.speakerIds.length > 100) errors.speakerIds = 'Choose at most 100 speakers.';
  useEffect(() => {
    const first = error?.fieldErrors.find(({ path }) => Object.hasOwn(values, path));
    if (first) document.getElementById(`${id}-${first.path}`)?.focus();
  }, [error, id, values]);
  function message(field: Field) {
    return (
      (attempted && errors[field]) ||
      error?.fieldErrors.find(({ path }) => path === field)?.message ||
      ''
    );
  }
  function input(field: Field) {
    return {
      id: `${id}-${field}`,
      name: field,
      fullWidth: true,
      disabled: pending,
      error: Boolean(message(field)),
      helperText: message(field),
    };
  }
  function change<FieldName extends Field>(field: FieldName, value: (typeof values)[FieldName]) {
    setValues({ ...values, [field]: value });
    onChange();
  }
  return (
    <Stack
      component="form"
      aria-label="Session form"
      noValidate
      direction={{ xs: 'column', md: 'row' }}
      sx={{ flex: 1, minWidth: 0 }}
      onSubmit={(submission) => {
        submission.preventDefault();
        if (pending) return;
        setAttempted(true);
        const first = Object.entries(errors).find(([, value]) => value);
        if (first) {
          document.getElementById(`${id}-${first[0]}`)?.focus();
          return;
        }
        onSubmit({
          title: values.title.trim(),
          summary: values.summary.trim() || null,
          room: values.room.trim() || null,
          startsAt: eventInputInstant(values.startsAt, original.startsAt),
          endsAt: eventInputInstant(values.endsAt, original.endsAt),
          speakerIds: values.speakerIds,
        });
      }}
    >
      <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1, minWidth: 0 }}>
        {header}
        <Stack sx={{ gap: 3, maxWidth: 520, mx: 'auto' }}>
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
          <ContentSection title="Session details">
            <TextField
              {...input('title')}
              label="Title"
              autoFocus
              value={values.title}
              onChange={(e) => {
                change('title', e.target.value);
              }}
            />
            <TextField
              {...input('summary')}
              label="Summary"
              multiline
              minRows={4}
              value={values.summary}
              onChange={(e) => {
                change('summary', e.target.value);
              }}
            />
          </ContentSection>
          <ContentSection
            title="Schedule & speakers"
            description="All times are in Europe/Sofia. Sessions must fit within the event."
          >
            <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2 }}>
              <TextField
                {...input('startsAt')}
                label="Starts at"
                type="datetime-local"
                slotProps={{ inputLabel: { shrink: true } }}
                value={values.startsAt}
                onChange={(e) => {
                  change('startsAt', e.target.value);
                }}
              />
              <TextField
                {...input('endsAt')}
                label="Ends at"
                type="datetime-local"
                slotProps={{ inputLabel: { shrink: true } }}
                value={values.endsAt}
                onChange={(e) => {
                  change('endsAt', e.target.value);
                }}
              />
            </Stack>
            <TextField
              {...input('room')}
              label="Room"
              value={values.room}
              onChange={(e) => {
                change('room', e.target.value);
              }}
            />
            <RelationSelect
              {...input('speakerIds')}
              label="Speakers"
              resource={speakersResource(storeId)}
              multiple
              value={values.speakerIds}
              onChange={(next) => {
                change('speakerIds', Array.isArray(next) ? next : []);
              }}
              helperText={message('speakerIds') || "Search the store's speaker directory."}
            />
          </ContentSection>
        </Stack>
      </Paper>
      <EditorAside
        label="Session summary"
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              loading={pending}
              aria-label="Save session"
              aria-busy={pending}
              sx={{ flex: 1 }}
            >
              Save session
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            Event
          </Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>{event.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {eventTime(event.startsAt).format('DD MMM YYYY, HH:mm')} –{' '}
            {eventTime(event.endsAt).format('DD MMM YYYY, HH:mm')} (Sofia)
          </Typography>
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            Summary
          </Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            {values.title || 'Untitled session'}
          </Typography>
          <Typography variant="body2">{values.speakerIds.length} speakers selected</Typography>
          <Typography variant="body2" color="text.secondary">
            Save this session independently of the event. Arrange its display order in the Sessions
            tab.
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
