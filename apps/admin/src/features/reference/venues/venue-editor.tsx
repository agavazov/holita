import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Breadcrumb, Button, Card, Skeleton, Tabs, Tag, Typography } from 'antd';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { venuesResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceVenueInput,
  GetReferenceVenueQuery,
  ReferenceVenueDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';
import { VenueForm } from './venue-form.js';

type VenueEditorProps = { storeId: string; onSaved: () => void };

export function VenueEditor({ storeId, onSaved }: VenueEditorProps) {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const resource = venuesResource(storeId);
  const submitting = useRef(false);
  const [tab, setTab] = useState('general');
  const listPath = `/${resource}`;
  const venue = useOne<GetReferenceVenueQuery['referenceVenue'], DataError>({
    resource,
    ...(venueId ? { id: venueId } : {}),
    queryOptions: { enabled: Boolean(venueId) },
    errorNotification: false,
  });
  const create = useCreate<ReferenceVenueDetailsFragment, DataError, CreateReferenceVenueInput>({
    successNotification: false,
    errorNotification: false,
  });
  const update = useUpdate<ReferenceVenueDetailsFragment, DataError, CreateReferenceVenueInput>({
    successNotification: false,
    errorNotification: false,
    mutationMode: 'pessimistic',
  });
  const pending = create.mutation.isPending || update.mutation.isPending;

  const changes = useUnsavedChanges(pending);

  function save(values: CreateReferenceVenueInput) {
    if (submitting.current) return;
    submitting.current = true;
    // Per-call callbacks belong to this mounted editor. Refine invalidates the captured resource.
    const callbacks = {
      onSuccess: () => {
        changes.saved();
        onSaved();
        void navigate(listPath);
      },
      onSettled: () => {
        submitting.current = false;
      },
    };
    if (venueId) update.mutate({ resource, id: venueId, values }, callbacks);
    else create.mutate({ resource, values }, callbacks);
  }

  return (
    <>
      {changes.dialog}
      <Breadcrumb
        className="page-breadcrumb"
        items={[
          { title: 'Reference' },
          { title: <Link to={listPath}>Venues</Link> },
          { title: venueId ? 'Edit venue' : 'Create venue' },
        ]}
      />
      <Card
        className="page-header"
        title={venueId ? 'Edit venue' : 'Create venue'}
        extra={
          venue.result && (
            <Tag color={venue.result.active ? 'green' : 'default'}>
              {venue.result.active ? 'Active' : 'Inactive'}
            </Tag>
          )
        }
      >
        <Typography.Text type="secondary">
          {venue.result
            ? `${venue.result.name} · ${venue.result.city} · ${venue.result.countryCode}`
            : 'Add a place for your events.'}
        </Typography.Text>
        <Tabs
          items={[
            { key: 'general', label: 'General' },
            { key: 'location', label: 'Location' },
          ]}
          activeKey={tab}
          onChange={setTab}
        />
      </Card>
      <Card className="venue-editor">
        {venueId && venue.query.isPending ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : venueId && venue.query.isError ? (
          <Alert
            type="error"
            showIcon
            message={venue.query.error.message}
            action={
              <Button
                onClick={() => {
                  void venue.query.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        ) : (
          <VenueForm
            key={venueId ?? 'create'}
            initialValues={venueId ? venue.result : undefined}
            tab={tab}
            onTabChange={setTab}
            onChange={changes.changed}
            pending={pending}
            error={create.mutation.error ?? update.mutation.error}
            onSubmit={save}
            onCancel={() => {
              void navigate(listPath);
            }}
          />
        )}
        {venueId && venue.query.isError && (
          <Button
            className="back-button"
            onClick={() => {
              void navigate(listPath);
            }}
          >
            Back to venues
          </Button>
        )}
      </Card>
    </>
  );
}
