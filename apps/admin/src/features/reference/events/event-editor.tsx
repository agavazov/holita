import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Breadcrumb, Button, Card, Skeleton, Space, Tabs, Tag, Typography } from 'antd';
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { eventsResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceEventInput,
  UpdateReferenceEventInput,
  GetReferenceEventQuery,
  ReferenceEventDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';
import { eventLink, eventListReturn, eventStatuses } from './event-list-state.js';
import { EventGallery } from '../media/event-gallery.js';
import { EventForm } from './event-form.js';

type EventEditorProps = { storeId: string; onSaved: () => void };

export function EventEditor({ storeId, onSaved }: EventEditorProps) {
  const { eventId } = useParams();
  const navigate = useNavigate();
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

  return (
    <>
      {changes.dialog}
      <Breadcrumb
        className="page-breadcrumb"
        items={[
          { title: 'Reference' },
          { title: <Link to={listPath}>Events</Link> },
          { title: eventId ? 'Edit event' : 'Create event' },
        ]}
      />
      <Card
        className="page-header"
        title={eventId ? 'Edit event' : 'Create event'}
        extra={
          <Space wrap>
            {event.result && (
              <Tag color={event.result.status === 'PUBLISHED' ? 'green' : 'default'}>
                {eventStatuses.find(({ value }) => value === event.result?.status)?.label}
              </Tag>
            )}
            {(pending || changes.dirty) && (
              <Typography.Text type="secondary" role="status">
                {pending ? 'Saving…' : 'Unsaved changes'}
              </Typography.Text>
            )}
          </Space>
        }
      >
        <Typography.Text type="secondary">
          {event.result
            ? `${event.result.title} · ${event.result.code}`
            : eventId
              ? event.query.isError
                ? 'Event details unavailable'
                : 'Loading event details…'
              : 'Plan a new event in this store.'}
        </Typography.Text>
        <Tabs
          items={[
            { key: 'general', label: 'General' },
            { key: 'schedule', label: 'Schedule & location' },
            { key: 'content', label: 'Content & media' },
          ]}
          activeKey={tab}
          onChange={setTab}
        />
      </Card>
      <Card className="event-editor">
        {eventId && event.query.isPending ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : eventId && event.query.isError ? (
          <Alert
            type="error"
            showIcon
            message={event.query.error.message}
            action={
              <Button
                onClick={() => {
                  void event.query.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        ) : (
          <EventForm
            storeId={storeId}
            key={eventId ?? 'create'}
            initialValues={eventId ? event.result : undefined}
            tab={tab}
            onTabChange={setTab}
            onChange={changes.changed}
            pending={pending}
            saveDisabled={galleryDirty || galleryPending}
            gallery={
              eventId ? (
                <EventGallery
                  key={eventId}
                  storeId={storeId}
                  eventId={eventId}
                  editable
                  disabled={pending}
                  onDirtyChange={setGalleryDirty}
                  onPendingChange={setGalleryPending}
                />
              ) : (
                <Alert type="info" showIcon message="Save the event before adding images." />
              )
            }
            error={create.mutation.error ?? update.mutation.error}
            onSubmit={save}
            onCancel={() => {
              void navigate(listPath);
            }}
          />
        )}
        {eventId && event.query.isError && (
          <Button
            className="back-button"
            onClick={() => {
              void navigate(listPath);
            }}
          >
            Back to events
          </Button>
        )}
      </Card>
    </>
  );
}
