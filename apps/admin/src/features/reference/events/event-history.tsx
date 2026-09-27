import { useList } from '@refinedev/core';
import { Alert, Button, Card, Empty, Table, Typography } from 'antd';
import { useState } from 'react';
import { historyResource, type DataError } from '../../../data/data-provider.js';
import type {
  ListReferenceEventHistoryQuery,
  ReferenceEventHistoryOperation,
} from '../../../generated/graphql/operations.js';
import { eventTime } from './event-time.js';

type Entry = ListReferenceEventHistoryQuery['referenceEventHistory']['items'][number];
const operations: Record<ReferenceEventHistoryOperation, string> = {
  CREATED: 'Event created',
  UPDATED: 'Event updated',
  TRASHED: 'Moved to trash',
  RESTORED: 'Event restored',
  SESSION_CREATED: 'Session created',
  SESSION_UPDATED: 'Session updated',
  SESSION_DELETED: 'Session deleted',
  SESSIONS_REORDERED: 'Sessions reordered',
  MEDIA_ADDED: 'Image added',
  MEDIA_UPDATED: 'Image updated',
  MEDIA_REMOVED: 'Image removed',
  MEDIA_REORDERED: 'Images reordered',
  COVER_CHANGED: 'Cover changed',
};
const fields: Record<string, string> = {
  title: 'Title',
  code: 'Code',
  status: 'Status',
  format: 'Format',
  capacity: 'Capacity',
  budget: 'Budget (EUR)',
  featured: 'Featured',
  startsAt: 'Start (UTC)',
  endsAt: 'End (UTC)',
  registrationOpensOn: 'Registration opens',
  registrationClosesOn: 'Registration closes',
  venue: 'Venue',
  tags: 'Tags',
  meetingUrl: 'Meeting link',
  summary: 'Summary',
  descriptionHtml: 'Description (HTML excerpt)',
  room: 'Room',
  speakers: 'Speakers',
  sessionOrder: 'Session order',
  galleryOrder: 'Image order',
  cover: 'Cover',
  altText: 'Alternative text',
};
export function EventHistory({ storeId, eventId }: { storeId: string; eventId: string }) {
  const [page, setPage] = useState(1);
  const history = useList<Entry, DataError>({
    resource: historyResource(storeId, eventId),
    pagination: { currentPage: page, pageSize: 20, mode: 'server' },
    errorNotification: false,
  });
  return (
    <Card title="Event history">
      <Typography.Paragraph type="secondary">
        Saved changes, newest first · Europe/Sofia. Long values are shown as excerpts.
      </Typography.Paragraph>
      {history.query.isError && (
        <Alert
          className="form-error"
          type="error"
          showIcon
          message={history.query.error.message}
          action={
            <Button
              onClick={() => {
                void history.query.refetch();
              }}
            >
              Retry
            </Button>
          }
        />
      )}
      <Table<Entry>
        rowKey="id"
        loading={history.query.isFetching}
        dataSource={history.query.isError ? [] : history.result.data}
        scroll={{ x: 620 }}
        locale={{
          emptyText: history.query.isPending ? (
            'Loading history…'
          ) : history.query.isError ? (
            'History unavailable'
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No changes recorded yet." />
          ),
        }}
        pagination={{
          current: page,
          pageSize: 20,
          total: history.result.total ?? 0,
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          {
            title: 'Change',
            key: 'change',
            render: (_: unknown, entry) => (
              <>
                <Typography.Text strong>{operations[entry.operation]}</Typography.Text>
                {entry.subject && <div>{entry.subject}</div>}
              </>
            ),
          },
          { title: 'Actor', dataIndex: 'actor' },
          {
            title: 'When (Sofia)',
            dataIndex: 'createdAt',
            render: (value: string) => eventTime(value).format('DD MMM YYYY, HH:mm:ss'),
          },
        ]}
        expandable={{
          rowExpandable: (entry) => entry.changes.length > 0,
          expandedRowRender: (entry) => (
            <div className="event-history-changes">
              {entry.changes.map((change) => (
                <div key={change.field}>
                  <Typography.Text strong>{fields[change.field] ?? change.field}</Typography.Text>
                  <div>
                    <Typography.Text type="secondary">Before: </Typography.Text>
                    {change.before ?? '—'}
                  </div>
                  <div>
                    <Typography.Text type="secondary">After: </Typography.Text>
                    {change.after ?? '—'}
                  </div>
                </div>
              ))}
            </div>
          ),
        }}
      />
    </Card>
  );
}
