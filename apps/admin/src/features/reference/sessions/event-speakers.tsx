import { useList } from '@refinedev/core';
import { Alert, Button, Card, Skeleton, Space, Tag, Typography } from 'antd';
import { sessionsResource, type DataError } from '../../../data/data-provider.js';
import type { ReferenceSessionDetailsFragment } from '../../../generated/graphql/operations.js';

export function EventSpeakers({ storeId, eventId }: { storeId: string; eventId: string }) {
  const sessions = useList<ReferenceSessionDetailsFragment, DataError>({
    resource: sessionsResource(storeId, eventId),
    pagination: { mode: 'off' },
    errorNotification: false,
  });
  const speakers = [
    ...new Map(
      sessions.result.data
        .flatMap((session) => session.speakers)
        .map((speaker) => [speaker.id, speaker]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Card title="Speakers" className="event-overview-card">
      {sessions.query.isPending ? (
        <Skeleton active paragraph={{ rows: 1 }} />
      ) : sessions.query.error ? (
        <Alert
          type="error"
          showIcon
          message={sessions.query.error.message}
          action={
            <Button
              onClick={() => {
                void sessions.query.refetch();
              }}
            >
              Retry
            </Button>
          }
        />
      ) : speakers.length ? (
        <Space wrap>
          {speakers.map((speaker) => (
            <Tag key={speaker.id} color={speaker.active ? 'blue' : 'default'}>
              {speaker.name}
              {speaker.active ? '' : ' (inactive)'}
            </Tag>
          ))}
        </Space>
      ) : (
        <Typography.Text type="secondary">
          Assign speakers to sessions to include them here.
        </Typography.Text>
      )}
    </Card>
  );
}
