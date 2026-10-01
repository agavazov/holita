import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Button, Paper, Skeleton, Typography } from '@mui/material';
import { PageHeader } from '../../../components/page-header.js';
import { QueryRefreshWarning } from '../../../components/query-refresh-warning.js';
import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { eventsResource, sessionsResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceSessionInput,
  UpdateReferenceSessionInput,
  ReferenceEventDetailsFragment,
  ReferenceSessionDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';
import { eventListReturn } from '../events/event-list-state.js';
import { SessionForm } from './session-form.js';

export function SessionEditor({
  storeId,
  eventId,
  sessionId,
  onSaved,
}: {
  storeId: string;
  eventId: string;
  sessionId?: string;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const resource = sessionsResource(storeId, eventId);
  const query = new URLSearchParams(search);
  query.set('tab', 'sessions');
  const back = `/${eventsResource(storeId)}/${eventId}?${query.toString()}`;
  const list = eventListReturn(eventsResource(storeId), search);
  const event = useOne<ReferenceEventDetailsFragment, DataError>({
    resource: eventsResource(storeId),
    id: eventId,
    errorNotification: false,
  });
  const session = useOne<ReferenceSessionDetailsFragment, DataError>({
    resource,
    ...(sessionId ? { id: sessionId } : {}),
    queryOptions: { enabled: Boolean(sessionId) },
    errorNotification: false,
  });
  const create = useCreate<ReferenceSessionDetailsFragment, DataError, CreateReferenceSessionInput>(
    { successNotification: false, errorNotification: false },
  );
  const update = useUpdate<ReferenceSessionDetailsFragment, DataError, UpdateReferenceSessionInput>(
    { successNotification: false, errorNotification: false, mutationMode: 'pessimistic' },
  );
  const pending = create.mutation.isPending || update.mutation.isPending;
  const submitting = useRef(false);
  const changes = useUnsavedChanges(pending);
  const failure = event.query.error ?? (sessionId ? session.query.error : null);
  function save(values: CreateReferenceSessionInput) {
    if (submitting.current) return;
    submitting.current = true;
    const callbacks = {
      onSuccess: () => {
        changes.saved();
        onSaved();
        void navigate(back, { replace: true });
      },
      onSettled: () => {
        submitting.current = false;
      },
    };
    if (sessionId) update.mutate({ resource, id: sessionId, values }, callbacks);
    else create.mutate({ resource, values }, callbacks);
  }
  const header = (
    <>
      <PageHeader
        embedded
        title={sessionId ? 'Edit session' : 'Add session'}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Events', to: list },
          { label: event.result?.title ?? 'Event', to: back },
          { label: sessionId ? 'Edit session' : 'Add session' },
        ]}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        {event.result?.title ?? 'Event program'} · Sessions have their own save action.
      </Typography>
      {(pending || changes.dirty) && (
        <Typography role="status" variant="body2" sx={{ mb: 2 }}>
          {pending ? 'Saving…' : 'Unsaved changes'}
        </Typography>
      )}
    </>
  );
  return (
    <>
      {changes.dialog}
      {failure && event.result && (!sessionId || session.result) && (
        <QueryRefreshWarning
          message={failure.message}
          refreshing={event.query.isFetching || (Boolean(sessionId) && session.query.isFetching)}
          onRetry={() => {
            void event.query.refetch();
            if (sessionId) void session.query.refetch();
          }}
        />
      )}
      {!event.result || (sessionId && !session.result) ? (
        <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
          {header}
          {failure ? (
            <>
              <Alert
                severity="error"
                action={
                  <Button
                    onClick={() => {
                      void event.query.refetch();
                      if (sessionId) void session.query.refetch();
                    }}
                  >
                    Retry
                  </Button>
                }
              >
                {failure.message}
              </Alert>
              <Button
                sx={{ mt: 2 }}
                onClick={() => {
                  void navigate(back);
                }}
              >
                Back to sessions
              </Button>
            </>
          ) : (
            <Skeleton variant="rounded" height={300} />
          )}
        </Paper>
      ) : (
        <SessionForm
          header={header}
          storeId={storeId}
          event={event.result}
          initialValues={sessionId ? session.result : undefined}
          pending={pending}
          error={create.mutation.error ?? update.mutation.error}
          onSubmit={save}
          onCancel={() => {
            void navigate(back);
          }}
          onChange={() => {
            changes.changed();
            create.mutation.reset();
            update.mutation.reset();
          }}
        />
      )}
    </>
  );
}
