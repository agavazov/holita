import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Box, Button, Skeleton, Stack } from '@mui/material';
import { PageHeader } from '../../../components/page-header.js';
import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { venuesResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceVenueInput,
  GetReferenceVenueQuery,
  ReferenceVenueDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { VenueForm } from './venue-form.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';

type VenueEditorProps = { storeId: string; onSaved: () => void };

export function VenueEditor({ storeId, onSaved }: VenueEditorProps) {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const resource = venuesResource(storeId);
  const submitting = useRef(false);
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

  const header = (
    <PageHeader
      embedded
      title={venueId ? 'Edit venue' : 'Create venue'}
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Reference' },
        { label: 'Venues', to: listPath },
        { label: venueId ? 'Edit venue' : 'Create venue' },
      ]}
    />
  );

  return (
    <Stack sx={{ flex: 1, minWidth: 0 }}>
      {changes.dialog}
      {venueId && (venue.query.isPending || venue.query.isError) && (
        <Box sx={{ p: { xs: 3, md: 5 } }}>{header}</Box>
      )}
      {venueId && venue.query.isPending ? (
        <Box sx={{ p: 5 }}>
          <Skeleton height={60} />
          <Skeleton height={200} />
        </Box>
      ) : venueId && venue.query.isError ? (
        <Alert
          severity="error"
          sx={{ m: 3 }}
          action={
            <Button
              onClick={() => {
                void venue.query.refetch();
              }}
            >
              Retry
            </Button>
          }
        >
          {venue.query.error.message}
        </Alert>
      ) : (
        <VenueForm
          header={header}
          initialValues={venueId ? venue.result : undefined}
          pending={pending}
          error={create.mutation.error ?? update.mutation.error}
          onChange={() => {
            changes.changed();
            create.mutation.reset();
            update.mutation.reset();
          }}
          onSubmit={save}
          onCancel={() => {
            void navigate(listPath);
          }}
        />
      )}
      {venueId && venue.query.isError && (
        <Button
          sx={{ m: 3, alignSelf: 'flex-start' }}
          onClick={() => {
            void navigate(listPath);
          }}
        >
          Back to venues
        </Button>
      )}
    </Stack>
  );
}
