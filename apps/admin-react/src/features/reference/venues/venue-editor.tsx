import { useTranslation } from 'react-i18next';
import { useLocalizedNavigate } from '../../../i18n/routing.js';
import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Box, Button, Skeleton, Stack } from '@mui/material';
import { PageHeader } from '../../../components/page-header.js';
import { QueryRefreshWarning } from '../../../components/query-refresh-warning.js';
import { useRef } from 'react';
import { useParams } from 'react-router';

import { venuesResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceVenueInput,
  GetReferenceVenueQuery,
  ReferenceVenueDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { VenueForm } from './venue-form.js';
import { useUnsavedChanges } from '../../use-unsaved-changes.js';

type VenueEditorProps = { storeId: string; onSaved: () => void };

export function VenueEditor({ storeId, onSaved }: VenueEditorProps) {
  const { t } = useTranslation(['reference', 'common']);
  const { venueId } = useParams();
  const navigate = useLocalizedNavigate();
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
      title={venueId ? t('reference:venues.actions.edit') : t('reference:venues.actions.create')}
      breadcrumbs={[
        { label: t('common:home'), to: '/' },
        { label: t('reference:label') },
        { label: t('reference:venues.title'), to: listPath },
        {
          label: venueId
            ? t('reference:venues.actions.edit')
            : t('reference:venues.actions.create'),
        },
      ]}
    />
  );

  return (
    <Stack sx={{ flex: 1, minWidth: 0 }}>
      {changes.dialog}
      {venueId && venue.query.isRefetchError && (
        <QueryRefreshWarning
          message={venue.query.error.message}
          refreshing={venue.query.isFetching}
          onRetry={() => {
            void venue.query.refetch();
          }}
        />
      )}
      {venueId && (venue.query.isPending || venue.query.isLoadingError) && (
        <Box sx={{ p: { xs: 3, md: 5 } }}>{header}</Box>
      )}
      {venueId && venue.query.isPending ? (
        <Box sx={{ p: 5 }}>
          <Skeleton height={60} />
          <Skeleton height={200} />
        </Box>
      ) : venueId && venue.query.isLoadingError ? (
        <Alert
          severity="error"
          sx={{ m: 3 }}
          action={
            <Button
              onClick={() => {
                void venue.query.refetch();
              }}
            >
              {t('common:actions.retry')}
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
      {venueId && venue.query.isLoadingError && (
        <Button
          sx={{ m: 3, alignSelf: 'flex-start' }}
          onClick={() => {
            void navigate(listPath);
          }}
        >
          {t('reference:venues.actions.back')}
        </Button>
      )}
    </Stack>
  );
}
