import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Breadcrumb, Button, Card, Skeleton, Typography } from 'antd';
import { useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
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
  return (
    <>
      {changes.dialog}
      <Breadcrumb
        className="page-breadcrumb"
        items={[
          { title: 'Reference' },
          { title: <Link to={list}>Events</Link> },
          { title: <Link to={back}>{event.result?.title ?? 'Event'}</Link> },
          { title: sessionId ? 'Edit session' : 'Add session' },
        ]}
      />
      <Card className="page-header" title={sessionId ? 'Edit session' : 'Add session'}>
        <Typography.Text type="secondary">
          {event.result?.title ?? 'Event program'} · Sessions have their own save action.
        </Typography.Text>
      </Card>
      <Card className="event-editor">
        {failure ? (
          <Alert
            type="error"
            showIcon
            message={failure.message}
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
          />
        ) : !event.result || (sessionId && !session.result) ? (
          <Skeleton active />
        ) : (
          <SessionForm
            storeId={storeId}
            event={event.result}
            initialValues={sessionId ? session.result : undefined}
            pending={pending}
            error={create.mutation.error ?? update.mutation.error}
            onSubmit={save}
            onCancel={() => {
              void navigate(back);
            }}
            onChange={changes.changed}
          />
        )}
        {failure && (
          <Link to={back}>
            <Button className="back-button">Back to sessions</Button>
          </Link>
        )}
      </Card>
    </>
  );
}
