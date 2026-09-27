import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Breadcrumb, Button, Card, Skeleton, Tag, Typography } from 'antd';
import { useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { speakersResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceSpeakerInput,
  GetReferenceSpeakerQuery,
  ReferenceSpeakerDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';
import { SpeakerForm } from './speaker-form.js';

type SpeakerEditorProps = { storeId: string; onSaved: () => void };

export function SpeakerEditor({ storeId, onSaved }: SpeakerEditorProps) {
  const { speakerId } = useParams();
  const navigate = useNavigate();
  const resource = speakersResource(storeId);
  const submitting = useRef(false);
  const listPath = `/${resource}`;
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

  return (
    <>
      {changes.dialog}
      <Breadcrumb
        className="page-breadcrumb"
        items={[
          { title: 'Reference' },
          { title: <Link to={listPath}>Speakers</Link> },
          { title: speakerId ? 'Edit speaker' : 'Create speaker' },
        ]}
      />
      <Card
        className="page-header"
        title={speakerId ? 'Edit speaker' : 'Create speaker'}
        extra={
          speaker.result && (
            <Tag color={speaker.result.active ? 'green' : 'default'}>
              {speaker.result.active ? 'Active' : 'Inactive'}
            </Tag>
          )
        }
      >
        <Typography.Text type="secondary">
          {speaker.result ? speaker.result.name : 'Add a speaker to your directory.'}
        </Typography.Text>
      </Card>
      <Card className="speaker-editor">
        {speakerId && speaker.query.isPending ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : speakerId && speaker.query.isError ? (
          <Alert
            type="error"
            showIcon
            message={speaker.query.error.message}
            action={
              <Button
                onClick={() => {
                  void speaker.query.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        ) : (
          <SpeakerForm
            key={speakerId ?? 'create'}
            initialValues={speakerId ? speaker.result : undefined}
            onChange={changes.changed}
            pending={pending}
            error={create.mutation.error ?? update.mutation.error}
            onSubmit={save}
            onCancel={() => {
              void navigate(listPath);
            }}
          />
        )}
        {speakerId && speaker.query.isError && (
          <Button
            className="back-button"
            onClick={() => {
              void navigate(listPath);
            }}
          >
            Back to speakers
          </Button>
        )}
      </Card>
    </>
  );
}
