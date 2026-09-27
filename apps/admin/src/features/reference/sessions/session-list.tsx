import { useDelete, useList } from '@refinedev/core';
import { Alert, Button, Card, Empty, Modal, Skeleton, Space, Tag, Typography } from 'antd';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { sessionsResource, type DataError } from '../../../data/data-provider.js';
import type { ReferenceSessionDetailsFragment } from '../../../generated/graphql/operations.js';
import { eventTime } from '../events/event-time.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';
import { useSessionOrder } from './use-session-order.js';

export function SessionList({
  storeId,
  eventId,
  search,
}: {
  storeId: string;
  eventId: string;
  search: string;
}) {
  const resource = sessionsResource(storeId, eventId);
  const sessions = useList<ReferenceSessionDetailsFragment, DataError>({
    resource,
    pagination: { mode: 'off' },
    errorNotification: false,
  });
  const [draft, setDraft] = useState<ReferenceSessionDetailsFragment[] | null>(null);
  const [deleting, setDeleting] = useState<ReferenceSessionDetailsFragment | null>(null);
  const [reloading, setReloading] = useState(false);
  const [notice, setNotice] = useState('');
  const order = useSessionOrder();
  const deletion = useDelete<ReferenceSessionDetailsFragment, DataError>();
  const submitting = useRef(false);
  const pending = order.mutation.isPending || deletion.mutation.isPending || reloading;
  const changes = useUnsavedChanges(pending, Boolean(draft));
  const rows = draft ?? sessions.result.data;
  function move(id: string, targetId: string) {
    if (pending || id === targetId) return;
    const from = rows.findIndex((row) => row.id === id),
      to = rows.findIndex((row) => row.id === targetId);
    const row = rows[from];
    if (!row || to < 0) return;
    const next = rows.filter((item) => item.id !== id);
    next.splice(to, 0, row);
    const unchanged = next.every((item, i) => item.id === sessions.result.data[i]?.id);
    setDraft(unchanged ? null : next);
    setNotice(`Moved ${row.title} to position ${String(to + 1)}.`);
    order.mutation.reset();
  }
  function save() {
    if (!draft || submitting.current) return;
    submitting.current = true;
    order.mutate(
      {
        url: resource,
        method: 'post',
        values: { ids: draft.map((row) => row.id) },
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setDraft(null);
          setNotice('Session order saved.');
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  async function cancel() {
    if (submitting.current) return;
    submitting.current = true;
    setReloading(true);
    const response = await sessions.query.refetch();
    if (response.isSuccess) {
      setDraft(null);
      order.mutation.reset();
      setNotice('Server order restored.');
    }
    setReloading(false);
    submitting.current = false;
  }
  function remove() {
    if (!deleting || submitting.current) return;
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
          setNotice('Session deleted.');
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  return (
    <Card
      title={
        <Space>
          Sessions <Tag>{sessions.result.total ?? 0} / 100</Tag>
        </Space>
      }
      className="session-program"
      extra={
        <Link
          to={`/${resource}/create${search}`}
          aria-disabled={pending || Boolean(draft) || rows.length >= 100}
          onClick={(event) => {
            if (pending || draft || rows.length >= 100) event.preventDefault();
          }}
        >
          <Button
            type="primary"
            aria-label="Add session"
            icon={<span aria-hidden="true">+</span>}
            disabled={pending || Boolean(draft) || rows.length >= 100}
          >
            Add session
          </Button>
        </Link>
      }
    >
      {changes.dialog}
      <Typography.Paragraph type="secondary">
        Build the event program. Drag sessions or use the arrows, then save the order. Display order
        is independent of time.
      </Typography.Paragraph>
      <div className="session-order-toolbar">
        <Typography.Text type={draft ? 'warning' : 'secondary'}>
          {draft
            ? 'Unsaved order · Save or cancel before editing sessions.'
            : 'Changes to individual sessions are saved separately.'}
        </Typography.Text>
        <Space wrap>
          <Button
            onClick={() => {
              void cancel();
            }}
            disabled={!draft || pending}
            loading={reloading}
            aria-label="Cancel order"
          >
            Cancel order
          </Button>
          <Button
            type="primary"
            onClick={save}
            disabled={!draft || pending}
            loading={order.mutation.isPending}
            aria-label="Save order"
            aria-busy={order.mutation.isPending}
          >
            Save order
          </Button>
        </Space>
      </div>
      {(sessions.query.error || order.mutation.error) && (
        <Alert
          className="form-error"
          type="error"
          showIcon
          message={(order.mutation.error ?? sessions.query.error)?.message}
          action={
            !draft && (
              <Button
                onClick={() => {
                  void sessions.query.refetch();
                }}
              >
                Retry
              </Button>
            )
          }
        />
      )}
      <span className="session-announcement" role="status" aria-live="polite">
        {notice}
      </span>
      {sessions.query.isPending ? (
        <Skeleton active />
      ) : !rows.length && !sessions.query.isError ? (
        <Empty description="No sessions yet. Add the first session to build this event's program." />
      ) : (
        <ol className="session-list" aria-label="Event sessions">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="session-item"
              draggable={!pending}
              aria-label={row.title}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', row.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (!pending) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                move(event.dataTransfer.getData('text/plain'), row.id);
              }}
            >
              <div className="session-order-controls">
                <span aria-hidden="true">⠿</span>
                <Typography.Text type="secondary">{index + 1}</Typography.Text>
                <Button
                  size="small"
                  icon={<span aria-hidden="true">↑</span>}
                  aria-label={`Move ${row.title} up`}
                  disabled={pending || index === 0}
                  onClick={() => {
                    const target = rows[index - 1];
                    if (target) move(row.id, target.id);
                  }}
                />
                <Button
                  size="small"
                  icon={<span aria-hidden="true">↓</span>}
                  aria-label={`Move ${row.title} down`}
                  disabled={pending || index === rows.length - 1}
                  onClick={() => {
                    const target = rows[index + 1];
                    if (target) move(row.id, target.id);
                  }}
                />
              </div>
              <div className="session-content">
                <Typography.Title level={5}>{row.title}</Typography.Title>
                <Space wrap split={<span aria-hidden="true">·</span>}>
                  <Typography.Text type="secondary">
                    {eventTime(row.startsAt).format('DD MMM, HH:mm')} –{' '}
                    {eventTime(row.endsAt).format('DD MMM, HH:mm')} (Sofia)
                  </Typography.Text>
                  {row.room && <Tag>{row.room}</Tag>}
                </Space>
                {row.summary && (
                  <Typography.Paragraph className="session-summary">
                    {row.summary}
                  </Typography.Paragraph>
                )}
                <div className="session-speakers">
                  {row.speakers.length ? (
                    row.speakers.map((speaker) => (
                      <Tag key={speaker.id}>
                        {speaker.name}
                        {speaker.active ? '' : ' (inactive)'}
                      </Tag>
                    ))
                  ) : (
                    <Typography.Text type="secondary">No speakers assigned</Typography.Text>
                  )}
                </div>
              </div>
              <Space className="session-actions">
                <Link
                  to={`/${resource}/${row.id}/edit${search}`}
                  aria-disabled={pending || Boolean(draft)}
                  onClick={(event) => {
                    if (pending || draft) event.preventDefault();
                  }}
                >
                  <Button disabled={pending || Boolean(draft)} aria-label={`Edit ${row.title}`}>
                    Edit
                  </Button>
                </Link>
                <Button
                  danger
                  disabled={pending || Boolean(draft)}
                  aria-label={`Delete ${row.title}`}
                  onClick={() => {
                    deletion.mutation.reset();
                    setDeleting(row);
                  }}
                >
                  Delete
                </Button>
              </Space>
            </li>
          ))}
        </ol>
      )}
      <Modal
        title="Delete session?"
        open={Boolean(deleting)}
        onOk={remove}
        onCancel={() => {
          if (!pending) setDeleting(null);
        }}
        okText="Delete session"
        okButtonProps={{ danger: true }}
        confirmLoading={deletion.mutation.isPending}
        cancelButtonProps={{ disabled: pending }}
        closable={!pending}
        maskClosable={!pending}
      >
        <Typography.Paragraph>
          {deleting?.title} will be permanently removed from this event.
        </Typography.Paragraph>
        {deletion.mutation.error && (
          <Alert type="error" showIcon message={deletion.mutation.error.message} />
        )}
      </Modal>
    </Card>
  );
}
