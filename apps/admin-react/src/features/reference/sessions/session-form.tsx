import { useFormat } from '../../../i18n/use-format.js';
import { useTranslation } from 'react-i18next';
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
import { textError } from '../text-validation.js';

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
  const { t } = useTranslation(['validation', 'reference', 'common']);
  const format = useFormat();
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
    errors[field] = textError(values[field], max, field === 'title' ? t('reference.title') : '', t);
  }
  for (const field of ['startsAt', 'endsAt'] as const) {
    try {
      const time = eventInputInstant(values[field], original[field], t);
      if (
        Date.parse(time) < Date.parse(event.startsAt) ||
        Date.parse(time) > Date.parse(event.endsAt)
      )
        errors[field] = t('reference.withinEvent');
    } catch (failure) {
      errors[field] = failure instanceof Error ? failure.message : t('reference.dateTime');
    }
  }
  if (
    !errors.startsAt &&
    !errors.endsAt &&
    eventInputInstant(values.endsAt, original.endsAt, t) <=
      eventInputInstant(values.startsAt, original.startsAt, t)
  )
    errors.endsAt = t('reference.endAfterStart');
  if (values.speakerIds.length > 100) errors.speakerIds = t('reference.speakers');
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
      aria-label={t('reference:sessions.form.label')}
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
          startsAt: eventInputInstant(values.startsAt, original.startsAt, t),
          endsAt: eventInputInstant(values.endsAt, original.endsAt, t),
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
                  {t('common:requestId', { id: error.requestId })}
                </Typography>
              )}
            </Alert>
          )}
          <ContentSection title={t('reference:sessions.form.details')}>
            <TextField
              {...input('title')}
              label={t('reference:fields.title')}
              autoFocus
              value={values.title}
              onChange={(e) => {
                change('title', e.target.value);
              }}
            />
            <TextField
              {...input('summary')}
              label={t('common:summary')}
              multiline
              minRows={4}
              value={values.summary}
              onChange={(e) => {
                change('summary', e.target.value);
              }}
            />
          </ContentSection>
          <ContentSection
            title={t('reference:sessions.form.schedule')}
            description={t('reference:sessions.form.scheduleHint')}
          >
            <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2 }}>
              <TextField
                {...input('startsAt')}
                label={t('reference:fields.startsAt')}
                type="datetime-local"
                slotProps={{ inputLabel: { shrink: true } }}
                value={values.startsAt}
                onChange={(e) => {
                  change('startsAt', e.target.value);
                }}
              />
              <TextField
                {...input('endsAt')}
                label={t('reference:fields.endsAt')}
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
              label={t('reference:fields.room')}
              value={values.room}
              onChange={(e) => {
                change('room', e.target.value);
              }}
            />
            <RelationSelect
              {...input('speakerIds')}
              label={t('reference:speakers.title')}
              resource={speakersResource(storeId)}
              multiple
              value={values.speakerIds}
              onChange={(next) => {
                change('speakerIds', Array.isArray(next) ? next : []);
              }}
              helperText={message('speakerIds') || t('reference:sessions.form.speakersHint')}
            />
          </ContentSection>
        </Stack>
      </Paper>
      <EditorAside
        label={t('reference:sessions.form.aside')}
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="contained"
              type="submit"
              loading={pending}
              aria-label={t('reference:sessions.actions.save')}
              aria-busy={pending}
              sx={{ flex: 1 }}
            >
              {t('reference:sessions.actions.save')}
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            {t('reference:events.singular')}
          </Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>{event.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {format.dateTime(event.startsAt)} – {format.dateTime(event.endsAt)} (
            {t('reference:timezone')})
          </Typography>
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            {t('common:summary')}
          </Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            {values.title || t('reference:sessions.form.untitled')}
          </Typography>
          <Typography variant="body2">
            {t('reference:sessions.form.selectedSpeakers', { count: values.speakerIds.length })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('reference:sessions.form.saveHint')}
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
