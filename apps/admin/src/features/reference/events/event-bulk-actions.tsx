import { Alert, Button, Modal, Space, Typography } from 'antd';
import { useRef, useState } from 'react';
import type { EventAction } from '../../../data/events-provider.js';
import { useEventActions } from './use-event-actions.js';

export function EventBulkActions({
  resource,
  ids,
  trashed,
  onComplete,
}: {
  resource: string;
  ids: string[];
  trashed: boolean;
  onComplete: (message: string) => void;
}) {
  const actions = useEventActions();
  const submitting = useRef(false);
  const [confirmation, setConfirmation] = useState<{ label: string; values: EventAction }>();
  const pending = actions.mutation.isPending;
  function confirm(label: string, values: EventAction) {
    actions.mutation.reset();
    setConfirmation({ label, values });
  }
  function submit() {
    if (!confirmation || submitting.current) return;
    submitting.current = true;
    actions.mutate(
      {
        url: resource,
        method: 'post',
        values: confirmation.values,
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setConfirmation(undefined);
          onComplete(
            `${confirmation.label} completed for ${String(confirmation.values.ids.length)} ${confirmation.values.ids.length === 1 ? 'event' : 'events'}.`,
          );
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  if (!ids.length && !confirmation) return null;
  return (
    <>
      <Space wrap className="event-bulk-actions" aria-label="Selected event actions">
        <Typography.Text strong>{ids.length} selected on this page</Typography.Text>
        {trashed ? (
          <Button
            disabled={pending}
            onClick={() => {
              confirm('Restore', { action: 'restore', ids });
            }}
          >
            Restore selected
          </Button>
        ) : (
          <>
            <Button
              disabled={pending}
              onClick={() => {
                confirm('Publish', { action: 'status', status: 'PUBLISHED', ids });
              }}
            >
              Publish selected
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                confirm('Archive', { action: 'status', status: 'ARCHIVED', ids });
              }}
            >
              Archive selected
            </Button>
            <Button
              danger
              disabled={pending}
              onClick={() => {
                confirm('Move to trash', { action: 'trash', ids });
              }}
            >
              Trash selected
            </Button>
          </>
        )}
      </Space>
      <Modal
        title={`${confirmation?.label ?? 'Update'} selected events?`}
        open={Boolean(confirmation)}
        onOk={submit}
        okText={confirmation?.label}
        okButtonProps={{ danger: confirmation?.values.action === 'trash' }}
        confirmLoading={pending}
        cancelButtonProps={{ disabled: pending }}
        closable={!pending}
        maskClosable={!pending}
        onCancel={() => {
          if (!pending) setConfirmation(undefined);
        }}
      >
        <Typography.Paragraph>
          This applies to {confirmation?.values.ids.length} selected{' '}
          {confirmation?.values.ids.length === 1 ? 'event' : 'events'}. All selected events must be
          eligible; otherwise none will change.
        </Typography.Paragraph>
        {actions.mutation.isError && (
          <Alert type="error" showIcon message={actions.mutation.error.message} />
        )}
      </Modal>
    </>
  );
}
