import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Breadcrumb, Button, Card, Skeleton, Tag, Typography } from 'antd';
import { useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { tagsResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceTagInput,
  GetReferenceTagQuery,
  ReferenceTagDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';
import { TagForm } from './tag-form.js';

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

  return (
    <>
      {changes.dialog}
      <Breadcrumb
        className="page-breadcrumb"
        items={[
          { title: 'Reference' },
          { title: <Link to={listPath}>Tags</Link> },
          { title: tagId ? 'Edit tag' : 'Create tag' },
        ]}
      />
      <Card
        className="page-header"
        title={tagId ? 'Edit tag' : 'Create tag'}
        extra={
          tag.result && (
            <Tag color={tag.result.active ? 'green' : 'default'}>
              {tag.result.active ? 'Active' : 'Inactive'}
            </Tag>
          )
        }
      >
        <Typography.Text type="secondary">
          {tag.result ? tag.result.name : 'Organize events with a clear, consistent label.'}
        </Typography.Text>
      </Card>
      <Card className="tag-editor">
        {tagId && tag.query.isPending ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : tagId && tag.query.isError ? (
          <Alert
            type="error"
            showIcon
            message={tag.query.error.message}
            action={
              <Button
                onClick={() => {
                  void tag.query.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        ) : (
          <TagForm
            key={tagId ?? 'create'}
            initialValues={tagId ? tag.result : undefined}
            onChange={changes.changed}
            pending={pending}
            error={create.mutation.error ?? update.mutation.error}
            onSubmit={save}
            onCancel={() => {
              void navigate(listPath);
            }}
          />
        )}
        {tagId && tag.query.isError && (
          <Button
            className="back-button"
            onClick={() => {
              void navigate(listPath);
            }}
          >
            Back to tags
          </Button>
        )}
      </Card>
    </>
  );
}
