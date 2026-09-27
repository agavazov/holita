import { useDelete, useList, useUpdate } from '@refinedev/core';
import {
  Alert,
  Button,
  Card,
  Empty,
  Image,
  Input,
  Modal,
  Progress,
  Skeleton,
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { mediaResource, type DataError } from '../../../data/data-provider.js';
import type {
  ReferenceEventMediaDetailsFragment,
  UpdateReferenceEventMediaInput,
} from '../../../generated/graphql/operations.js';
import { useMediaMutation, useMediaUpload } from './use-media-actions.js';

type Props = {
  storeId: string;
  eventId: string;
  editable?: boolean;
  disabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
};
export function EventGallery({
  storeId,
  eventId,
  editable = false,
  disabled = false,
  onDirtyChange,
  onPendingChange,
}: Props) {
  const resource = mediaResource(storeId, eventId);
  const gallery = useList<ReferenceEventMediaDetailsFragment, DataError>({
    resource,
    pagination: { mode: 'off' },
    errorNotification: false,
    queryOptions: { refetchInterval: 8 * 60_000 },
  });
  const upload = useMediaUpload(resource);
  const action = useMediaMutation();
  const update = useUpdate<
    ReferenceEventMediaDetailsFragment,
    DataError,
    UpdateReferenceEventMediaInput
  >();
  const deletion = useDelete<ReferenceEventMediaDetailsFragment, DataError>();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<ReferenceEventMediaDetailsFragment | null>(null);
  const [altText, setAltText] = useState('');
  const [deleting, setDeleting] = useState<ReferenceEventMediaDetailsFragment | null>(null);
  const [reloading, setReloading] = useState(false);
  const [notice, setNotice] = useState('');
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const pending =
    Boolean(upload.state) ||
    action.mutation.isPending ||
    update.mutation.isPending ||
    deletion.mutation.isPending ||
    reloading;
  useEffect(() => {
    onDirtyChange?.(Boolean(draft));
  }, [draft, onDirtyChange]);
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  const locked = disabled || pending;
  const rows = draft
    ? draft.flatMap((id) => gallery.result.data.filter((row) => row.id === id))
    : gallery.result.data;
  const error =
    action.mutation.error?.message ??
    update.mutation.error?.message ??
    deletion.mutation.error?.message ??
    upload.error;
  function move(id: string, target: string) {
    if (locked || id === target) return;
    const next = rows.map((row) => row.id),
      from = next.indexOf(id),
      to = next.indexOf(target);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, id);
    setDraft(next.every((value, index) => value === gallery.result.data[index]?.id) ? null : next);
    action.mutation.reset();
    setNotice(`Image moved to position ${String(to + 1)}. Save order to keep this change.`);
  }
  function mutate(values: { action: 'cover'; id: string } | { action: 'reorder'; ids: string[] }) {
    if (submitting.current || locked) return;
    submitting.current = true;
    action.mutate(
      {
        url: resource,
        method: 'post',
        values,
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          if (values.action === 'reorder') setDraft(null);
          setNotice(values.action === 'cover' ? 'Cover saved.' : 'Gallery order saved.');
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  async function cancelOrder() {
    if (submitting.current || locked) return;
    submitting.current = true;
    setReloading(true);
    const response = await gallery.query.refetch();
    if (!mounted.current) return;
    if (response.isSuccess) {
      setDraft(null);
      action.mutation.reset();
      setNotice('Saved gallery order restored.');
    }
    setReloading(false);
    submitting.current = false;
  }
  function saveAlt() {
    if (!editing || submitting.current || locked) return;
    submitting.current = true;
    update.mutate(
      {
        resource,
        id: editing.id,
        values: { altText: altText.trim() || null },
        mutationMode: 'pessimistic',
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setEditing(null);
          setNotice('Alt text saved.');
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  function remove() {
    if (!deleting || submitting.current || locked) return;
    submitting.current = true;
    deletion.mutate(
      {
        resource,
        id: deleting.id,
        mutationMode: 'pessimistic',
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setDeleting(null);
          setNotice('Image removed.');
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  return (
    <section className="event-gallery" aria-label="Event gallery">
      <div className="gallery-heading">
        <div>
          <Typography.Title level={4}>Gallery</Typography.Title>
          <Typography.Paragraph type="secondary">
            {editable
              ? 'Up to 10 still JPEG, PNG or WebP images · 5 MiB and 20 megapixels each. Changes here are saved separately from the event.'
              : 'Images from this event.'}
          </Typography.Paragraph>
        </div>
        <Button
          disabled={locked}
          onClick={() => {
            void gallery.query.refetch();
          }}
        >
          Refresh previews
        </Button>
      </div>
      {gallery.query.isError && (
        <Alert type="error" showIcon message={gallery.query.error.message} />
      )}
      {error && <Alert className="form-error" type="error" showIcon message={error} />}
      {editable && (
        <div className="gallery-toolbar">
          <Upload
            accept="image/jpeg,image/png,image/webp"
            showUploadList={false}
            disabled={locked || Boolean(draft) || rows.length >= 10}
            beforeUpload={(file) => {
              void upload.upload(file);
              return false;
            }}
          >
            <Button disabled={locked || Boolean(draft) || rows.length >= 10}>Add image</Button>
          </Upload>
          {gallery.query.isSuccess && (
            <Typography.Text type="secondary">{rows.length} / 10 images</Typography.Text>
          )}
          {draft && (
            <Space wrap>
              <Button
                type="primary"
                disabled={locked}
                onClick={() => {
                  mutate({ action: 'reorder', ids: draft });
                }}
              >
                Save order
              </Button>
              <Button
                disabled={locked}
                onClick={() => {
                  void cancelOrder();
                }}
              >
                Cancel order
              </Button>
            </Space>
          )}
        </div>
      )}
      {upload.state && (
        <div className="gallery-upload" role="status">
          <Typography.Text>
            {upload.state.finishing ? 'Finishing' : 'Uploading'} {upload.state.name}
          </Typography.Text>
          <Progress percent={upload.state.percent} status="active" />
          <Button disabled={upload.state.finishing} onClick={upload.cancel}>
            Cancel upload
          </Button>
        </div>
      )}
      {gallery.query.isPending ? (
        <Skeleton active />
      ) : gallery.query.isError ? (
        <Typography.Paragraph type="secondary">
          Gallery unavailable. Use Refresh previews to try again.
        </Typography.Paragraph>
      ) : !rows.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No images yet" />
      ) : (
        <Image.PreviewGroup>
          <div className="gallery-grid">
            {rows.map((row, index) => (
              <Card
                key={row.id}
                size="small"
                className="gallery-image-card"
                aria-label={`Image ${row.originalName}`}
                draggable={editable && !locked}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', row.id);
                }}
                onDragOver={(event) => {
                  if (editable && !locked) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (editable) move(event.dataTransfer.getData('text/plain'), row.id);
                }}
              >
                <Image
                  src={row.readUrl}
                  alt={row.altText ?? row.originalName}
                  width="100%"
                  height={160}
                />
                <div className="gallery-image-title">
                  <Typography.Text ellipsis title={row.originalName}>
                    {row.originalName}
                  </Typography.Text>
                  {row.isCover && <Tag color="blue">Cover</Tag>}
                </div>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                  {row.altText ?? 'No alt text'}
                </Typography.Paragraph>
                {editable && (
                  <Space wrap size={4}>
                    <Button
                      size="small"
                      disabled={locked || Boolean(draft) || row.isCover}
                      onClick={() => {
                        mutate({ action: 'cover', id: row.id });
                      }}
                    >
                      Set cover
                    </Button>
                    <Button
                      size="small"
                      disabled={locked || Boolean(draft)}
                      onClick={() => {
                        update.mutation.reset();
                        setEditing(row);
                        setAltText(row.altText ?? '');
                      }}
                    >
                      Alt text
                    </Button>
                    <Button
                      size="small"
                      aria-label={`Move ${row.originalName} earlier`}
                      disabled={locked || index === 0}
                      onClick={() => {
                        const previous = rows[index - 1];
                        if (previous) move(row.id, previous.id);
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      size="small"
                      aria-label={`Move ${row.originalName} later`}
                      disabled={locked || index === rows.length - 1}
                      onClick={() => {
                        const next = rows[index + 1];
                        if (next) move(row.id, next.id);
                      }}
                    >
                      ↓
                    </Button>
                    <Button
                      size="small"
                      danger
                      disabled={locked || Boolean(draft)}
                      onClick={() => {
                        deletion.mutation.reset();
                        setDeleting(row);
                      }}
                    >
                      Remove
                    </Button>
                  </Space>
                )}
              </Card>
            ))}
          </div>
        </Image.PreviewGroup>
      )}
      <div role="status">{notice}</div>
      <Modal
        title="Image alt text"
        open={Boolean(editing)}
        onOk={saveAlt}
        okText="Save alt text"
        confirmLoading={update.mutation.isPending}
        onCancel={() => {
          if (!locked) setEditing(null);
        }}
        cancelButtonProps={{ disabled: locked }}
        closable={!locked}
        maskClosable={!locked}
      >
        <Typography.Paragraph>
          Describe the image for people using assistive technology.
        </Typography.Paragraph>
        <Input.TextArea
          aria-label="Alt text"
          value={altText}
          onChange={(event) => {
            setAltText(event.target.value);
          }}
          maxLength={300}
          showCount
          rows={3}
          disabled={locked}
        />
        {update.mutation.isError && <Alert type="error" message={update.mutation.error.message} />}
      </Modal>
      <Modal
        title="Remove image?"
        open={Boolean(deleting)}
        onOk={remove}
        okText="Remove image"
        okButtonProps={{ danger: true }}
        confirmLoading={deletion.mutation.isPending}
        onCancel={() => {
          if (!locked) setDeleting(null);
        }}
        cancelButtonProps={{ disabled: locked }}
        closable={!locked}
        maskClosable={!locked}
      >
        <Typography.Paragraph>
          {deleting?.originalName} will be removed from this gallery. This cannot be undone.
        </Typography.Paragraph>
        {deletion.mutation.isError && (
          <Alert type="error" message={deletion.mutation.error.message} />
        )}
      </Modal>
    </section>
  );
}
