import { useTranslation } from 'react-i18next';
import { useLocalizedNavigate } from '../../../i18n/routing.js';
import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Button, Paper, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import { PageHeader } from '../../../components/page-header.js';
import { QueryRefreshWarning } from '../../../components/query-refresh-warning.js';
import { useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';

import { eventsResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceEventInput,
  UpdateReferenceEventInput,
  GetReferenceEventQuery,
  ReferenceEventDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { useUnsavedChanges } from '../../use-unsaved-changes.js';
import { eventLink, eventListReturn } from './event-list-state.js';
import { EventGallery } from '../media/event-gallery.js';
import { EventForm } from './event-form.js';

type EventEditorProps = { storeId: string; onSaved: () => void };

export function EventEditor({ storeId, onSaved }: EventEditorProps) {
  const { t } = useTranslation(['reference', 'common']);
  const { eventId } = useParams();
  const navigate = useLocalizedNavigate();
  const resource = eventsResource(storeId);
  const submitting = useRef(false);
  const [galleryDirty, setGalleryDirty] = useState(false);
  const [galleryPending, setGalleryPending] = useState(false);
  const [tab, setTab] = useState('general');
  const { search } = useLocation();
  const listPath = eventListReturn(resource, search);
  const listSearch = listPath.slice(`/${resource}`.length);
  const event = useOne<GetReferenceEventQuery['referenceEvent'], DataError>({
    resource,
    ...(eventId ? { id: eventId } : {}),
    queryOptions: { enabled: Boolean(eventId) },
    errorNotification: false,
  });
  const create = useCreate<ReferenceEventDetailsFragment, DataError, CreateReferenceEventInput>({
    successNotification: false,
    errorNotification: false,
  });
  const update = useUpdate<ReferenceEventDetailsFragment, DataError, UpdateReferenceEventInput>({
    successNotification: false,
    errorNotification: false,
    mutationMode: 'pessimistic',
  });
  const pending = create.mutation.isPending || update.mutation.isPending;

  const changes = useUnsavedChanges(pending, galleryDirty);

  function save(values: CreateReferenceEventInput) {
    if (submitting.current || galleryPending || galleryDirty) return;
    submitting.current = true;
    // Per-call callbacks belong to this mounted editor. Refine invalidates the captured resource.
    const callbacks = {
      onSuccess: (response: { data: ReferenceEventDetailsFragment }) => {
        changes.saved();
        onSaved();
        void navigate(
          eventLink(resource, `${response.data.id}${eventId ? '' : '/edit'}`, listSearch),
          { replace: true },
        );
      },
      onSettled: () => {
        submitting.current = false;
      },
    };
    if (eventId) {
      const { code: _code, ...input } = values;
      update.mutate({ resource, id: eventId, values: input }, callbacks);
    } else create.mutate({ resource, values }, callbacks);
  }

  const header = (
    <>
      <PageHeader
        embedded
        title={eventId ? t('reference:events.actions.edit') : t('reference:events.actions.create')}
        breadcrumbs={[
          { label: t('common:home'), to: '/' },
          { label: t('reference:label') },
          { label: t('reference:events.title'), to: listPath },
          {
            label: eventId
              ? t('reference:events.actions.edit')
              : t('reference:events.actions.create'),
          },
        ]}
      />
      <Stack sx={{ gap: 2, mb: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {event.result
            ? `${event.result.title} · ${event.result.code}`
            : eventId
              ? event.query.isError
                ? t('reference:events.messages.unavailable')
                : t('reference:events.messages.loading')
              : t('reference:events.messages.new')}
        </Typography>
        {(pending || changes.dirty) && (
          <Typography variant="body2" color="text.secondary" role="status">
            {pending ? t('common:saving') : t('common:unsaved.label')}
          </Typography>
        )}
        <Tabs
          value={tab}
          onChange={(_, value: string) => {
            setTab(value);
          }}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={t('reference:events.tabs.sections')}
        >
          <Tab value="general" label={t('reference:events.tabs.general')} />
          <Tab value="schedule" label={t('reference:events.tabs.schedule')} />
          <Tab value="content" label={t('reference:events.tabs.contentMedia')} />
        </Tabs>
      </Stack>
    </>
  );
  return (
    <>
      {changes.dialog}
      {eventId && event.query.isRefetchError && (
        <QueryRefreshWarning
          message={event.query.error.message}
          refreshing={event.query.isFetching}
          onRetry={() => {
            void event.query.refetch();
          }}
        />
      )}
      {eventId && (event.query.isPending || event.query.isLoadingError) ? (
        <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
          {header}
          {event.query.isPending ? (
            <Skeleton variant="rounded" height={300} />
          ) : (
            <>
              <Alert
                severity="error"
                action={
                  <Button
                    onClick={() => {
                      void event.query.refetch();
                    }}
                  >
                    {t('common:actions.retry')}
                  </Button>
                }
              >
                {event.query.error.message}
              </Alert>
              <Button
                sx={{ mt: 2 }}
                onClick={() => {
                  void navigate(listPath);
                }}
              >
                {t('reference:events.actions.back')}
              </Button>
            </>
          )}
        </Paper>
      ) : (
        <EventForm
          storeId={storeId}
          header={header}
          initialValues={eventId ? event.result : undefined}
          tab={tab}
          onTabChange={setTab}
          onChange={() => {
            changes.changed();
            create.mutation.reset();
            update.mutation.reset();
          }}
          pending={pending}
          saveDisabled={galleryDirty || galleryPending}
          gallery={
            eventId ? (
              <EventGallery
                storeId={storeId}
                eventId={eventId}
                editable
                disabled={pending}
                onDirtyChange={setGalleryDirty}
                onPendingChange={setGalleryPending}
              />
            ) : (
              <Alert severity="info">{t('reference:events.messages.saveBeforeImages')}</Alert>
            )
          }
          error={create.mutation.error ?? update.mutation.error}
          onSubmit={save}
          onCancel={() => {
            void navigate(listPath);
          }}
        />
      )}
    </>
  );
}
