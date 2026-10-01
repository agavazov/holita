import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Box, Button, Skeleton, Stack } from '@mui/material';
import { PageHeader } from '../../../components/page-header.js';
import { QueryRefreshWarning } from '../../../components/query-refresh-warning.js';
import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { tagsResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceTagInput,
  GetReferenceTagQuery,
  ReferenceTagDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { TagForm } from './tag-form.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';

type TagEditorProps = { storeId: string; onSaved: () => void };

export function TagEditor({ storeId, onSaved }: TagEditorProps) {
  const { tagId } = useParams();
  const navigate = useNavigate();
  const resource = tagsResource(storeId);
  const submitting = useRef(false);
  const listPath = `/${resource}`;
  const tag = useOne<GetReferenceTagQuery['referenceTag'], DataError>({
    resource,
    ...(tagId ? { id: tagId } : {}),
    queryOptions: { enabled: Boolean(tagId) },
    errorNotification: false,
  });
  const create = useCreate<ReferenceTagDetailsFragment, DataError, CreateReferenceTagInput>({
    successNotification: false,
    errorNotification: false,
  });
  const update = useUpdate<ReferenceTagDetailsFragment, DataError, CreateReferenceTagInput>({
    successNotification: false,
    errorNotification: false,
    mutationMode: 'pessimistic',
  });
  const pending = create.mutation.isPending || update.mutation.isPending;

  const changes = useUnsavedChanges(pending);

  function save(values: CreateReferenceTagInput) {
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
    if (tagId) update.mutate({ resource, id: tagId, values }, callbacks);
    else create.mutate({ resource, values }, callbacks);
  }

  const header = (
    <PageHeader
      embedded
      title={tagId ? 'Edit tag' : 'Create tag'}
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Tags', to: listPath },
        { label: tagId ? 'Edit tag' : 'Create tag' },
      ]}
    />
  );

  return (
    <Stack sx={{ flex: 1, minWidth: 0 }}>
      {changes.dialog}
      {tagId && tag.query.isRefetchError && (
        <QueryRefreshWarning
          message={tag.query.error.message}
          refreshing={tag.query.isFetching}
          onRetry={() => {
            void tag.query.refetch();
          }}
        />
      )}
      {tagId && (tag.query.isPending || tag.query.isLoadingError) && (
        <Box sx={{ p: { xs: 3, md: 5 } }}>{header}</Box>
      )}
      {tagId && tag.query.isPending ? (
        <Box sx={{ p: 5 }}>
          <Skeleton height={60} />
          <Skeleton height={200} />
        </Box>
      ) : tagId && tag.query.isLoadingError ? (
        <Alert
          severity="error"
          sx={{ m: 3 }}
          action={
            <Button
              onClick={() => {
                void tag.query.refetch();
              }}
            >
              Retry
            </Button>
          }
        >
          {tag.query.error.message}
        </Alert>
      ) : (
        <TagForm
          header={header}
          initialValues={tagId ? tag.result : undefined}
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
      {tagId && tag.query.isLoadingError && (
        <Button
          sx={{ m: 3, alignSelf: 'flex-start' }}
          onClick={() => {
            void navigate(listPath);
          }}
        >
          Back to tags
        </Button>
      )}
    </Stack>
  );
}
