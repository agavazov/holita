import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Box, Button, Skeleton, Stack } from '@mui/material';
import { PageHeader } from '../../../components/page-header.js';
import { QueryRefreshWarning } from '../../../components/query-refresh-warning.js';
import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLocalization } from '../../../localization/localization-provider.js';
import { localizedPath } from '../../../localization/locale.js';

import { speakersResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceSpeakerInput,
  GetReferenceSpeakerQuery,
  ReferenceSpeakerDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { SpeakerForm } from './speaker-form.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';

type SpeakerEditorProps = { storeId: string; onSaved: () => void };

export function SpeakerEditor({ storeId, onSaved }: SpeakerEditorProps) {
  const { speakerId } = useParams();
  const navigate = useNavigate();
  const { locale, t } = useLocalization();
  const resource = speakersResource(storeId);
  const submitting = useRef(false);
  const listPath = localizedPath(locale, `/${resource}`);
  const speaker = useOne<GetReferenceSpeakerQuery['referenceSpeaker'], DataError>({
    resource,
    ...(speakerId ? { id: speakerId } : {}),
    queryOptions: { enabled: Boolean(speakerId) },
    errorNotification: false,
  });
  const create = useCreate<ReferenceSpeakerDetailsFragment, DataError, CreateReferenceSpeakerInput>(
    {
      successNotification: false,
      errorNotification: false,
    },
  );
  const update = useUpdate<ReferenceSpeakerDetailsFragment, DataError, CreateReferenceSpeakerInput>(
    {
      successNotification: false,
      errorNotification: false,
      mutationMode: 'pessimistic',
    },
  );
  const pending = create.mutation.isPending || update.mutation.isPending;

  const changes = useUnsavedChanges(pending);

  function save(values: CreateReferenceSpeakerInput) {
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
    if (speakerId) update.mutate({ resource, id: speakerId, values }, callbacks);
    else create.mutate({ resource, values }, callbacks);
  }

  const header = (
    <PageHeader
      embedded
      title={speakerId ? t('reference.editSpeaker') : t('reference.createSpeaker')}
      breadcrumbs={[
        { label: t('common.home'), to: localizedPath(locale, '/') },
        { label: t('shell.reference') },
        { label: t('shell.speakers'), to: listPath },
        { label: speakerId ? t('reference.editSpeaker') : t('reference.createSpeaker') },
      ]}
    />
  );

  return (
    <Stack sx={{ flex: 1, minWidth: 0 }}>
      {changes.dialog}
      {speakerId && speaker.query.isRefetchError && (
        <QueryRefreshWarning
          message={t('common.genericError')}
          refreshing={speaker.query.isFetching}
          onRetry={() => {
            void speaker.query.refetch();
          }}
        />
      )}
      {speakerId && (speaker.query.isPending || speaker.query.isLoadingError) && (
        <Box sx={{ p: { xs: 3, md: 5 } }}>{header}</Box>
      )}
      {speakerId && speaker.query.isPending ? (
        <Box sx={{ p: 5 }}>
          <Skeleton height={60} />
          <Skeleton height={200} />
        </Box>
      ) : speakerId && speaker.query.isLoadingError ? (
        <Alert
          severity="error"
          sx={{ m: 3 }}
          action={
            <Button
              onClick={() => {
                void speaker.query.refetch();
              }}
            >
              {t('common.retry')}
            </Button>
          }
        >
          {t('common.genericError')}
        </Alert>
      ) : (
        <SpeakerForm
          header={header}
          initialValues={speakerId ? speaker.result : undefined}
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
      {speakerId && speaker.query.isLoadingError && (
        <Button
          sx={{ m: 3, alignSelf: 'flex-start' }}
          onClick={() => {
            void navigate(listPath);
          }}
        >
          {t('reference.backToSpeakers')}
        </Button>
      )}
    </Stack>
  );
}
