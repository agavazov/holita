import { useDelete, useOne } from '@refinedev/core';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Modal,
  Row,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { eventsResource, type DataError } from '../../../data/data-provider.js';
import type { ReferenceEventDetailsFragment } from '../../../generated/graphql/operations.js';
import { eventFormats, eventLink, eventListReturn, eventStatuses } from './event-list-state.js';
import { SessionList } from '../sessions/session-list.js';
import { EventSpeakers } from '../sessions/event-speakers.js';
import { safeDescriptionHtml } from './description-html.js';
import { EventGallery } from '../media/event-gallery.js';
import { EventHistory } from './event-history.js';
import { useEventActions } from './use-event-actions.js';
import { eventTime } from './event-time.js';

export function EventShow({
  storeId,
  onChanged,
  onDeleted,
}: {
  storeId: string;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { eventId } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const requestedTab = new URLSearchParams(search).get('tab');
  const resource = eventsResource(storeId);
  const listPath = eventListReturn(resource, search);
  const listSearch = listPath.slice(`/${resource}`.length);
  const event = useOne<ReferenceEventDetailsFragment, DataError>({
    resource,
    ...(eventId ? { id: eventId } : {}),
    meta: { includeDeleted: true },
    queryOptions: { enabled: Boolean(eventId) },
    errorNotification: false,
  });
  const actions = useEventActions();
  const deletion = useDelete<ReferenceEventDetailsFragment, DataError>();
  const [confirm, setConfirm] = useState(false);
  const submitting = useRef(false);
  const pending = actions.mutation.isPending || deletion.mutation.isPending;
  const row = event.result;
  const tab =
    requestedTab === 'history'
      ? 'history'
      : requestedTab === 'sessions' && !row?.deletedAt
        ? 'sessions'
        : 'overview';
  function changeEvent() {
    if (!row || submitting.current) return;
    submitting.current = true;
    actions.mutate(
      {
        url: resource,
        method: 'post',
        values: row.deletedAt
          ? { action: 'restore', ids: [row.id] }
          : {
              action: 'status',
              ids: [row.id],
              status: row.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED',
            },
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: onChanged,
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  function remove() {
    if (!row || submitting.current) return;
    submitting.current = true;
    deletion.mutate(
      {
        resource,
        id: row.id,
        mutationMode: 'pessimistic',
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          onDeleted();
          void navigate(listPath, { replace: true });
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  return (
    <>
      <Breadcrumb
        className="page-breadcrumb"
        items={[
          { title: 'Reference' },
          { title: <Link to={listPath}>Events</Link> },
          { title: row?.title ?? 'Event' },
        ]}
      />
      {event.query.isPending ? (
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : event.query.isError || !row ? (
        <Card>
          <Alert
            type="error"
            showIcon
            message={event.query.error?.message ?? 'Event unavailable'}
            action={
              <Button
                onClick={() => {
                  void event.query.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
          <Link to={listPath}>
            <Button className="back-button">Back to events</Button>
          </Link>
        </Card>
      ) : (
        <>
          <Card
            className="page-header"
            title={
              <Space wrap>
                <span>{row.title}</span>
                <Tag color={row.status === 'PUBLISHED' ? 'green' : 'default'}>
                  {eventStatuses.find(({ value }) => value === row.status)?.label}
                </Tag>
                {row.deletedAt && <Tag color="orange">In trash</Tag>}
                {row.featured && <Tag color="blue">Featured</Tag>}
              </Space>
            }
            extra={
              row.deletedAt ? (
                <Button type="primary" loading={pending} onClick={changeEvent}>
                  Restore event
                </Button>
              ) : (
                <Space wrap>
                  <Link to={eventLink(resource, `${row.id}/edit`, listSearch)}>
                    <Button type="primary">Edit event</Button>
                  </Link>
                  <Button
                    onClick={changeEvent}
                    loading={actions.mutation.isPending}
                    disabled={pending}
                    aria-label={row.status === 'PUBLISHED' ? 'Archive' : 'Publish'}
                    aria-busy={pending}
                  >
                    {row.status === 'PUBLISHED' ? 'Archive' : 'Publish'}
                  </Button>
                  <Button
                    danger
                    disabled={pending}
                    onClick={() => {
                      deletion.mutation.reset();
                      setConfirm(true);
                    }}
                  >
                    Move to trash
                  </Button>
                </Space>
              )
            }
          >
            <Space wrap split={<span aria-hidden="true">·</span>} className="event-show-meta">
              <Typography.Text type="secondary">{row.code}</Typography.Text>
              <Typography.Text type="secondary">
                {eventTime(row.startsAt).format('DD MMM YYYY, HH:mm')} (Sofia)
              </Typography.Text>
              <Typography.Text type="secondary">{row.venue?.name ?? 'Online'}</Typography.Text>
              <Typography.Text type="secondary">
                {eventFormats.find(({ value }) => value === row.format)?.label}
              </Typography.Text>
            </Space>
            <Tabs
              activeKey={tab}
              items={[
                { key: 'overview', label: 'Overview' },
                { key: 'sessions', label: 'Sessions', disabled: Boolean(row.deletedAt) },
                { key: 'history', label: 'History' },
              ]}
              onChange={(next) => {
                const query = new URLSearchParams(search);
                if (next === 'overview') query.delete('tab');
                else query.set('tab', next);
                void navigate({ search: query.toString() ? `?${query.toString()}` : '' });
              }}
            />
          </Card>
          {actions.mutation.isError && (
            <Alert
              className="form-error"
              type="error"
              showIcon
              message={actions.mutation.error.message}
            />
          )}
          {row.deletedAt && (
            <Alert
              className="form-error"
              type="info"
              showIcon
              message="This event is in Trash. Restore it to edit or access its sessions and gallery."
            />
          )}
          {tab === 'history' ? (
            <EventHistory storeId={storeId} eventId={row.id} />
          ) : tab === 'sessions' ? (
            <SessionList storeId={storeId} eventId={row.id} search={search} />
          ) : (
            <Row gutter={[20, 20]}>
              <Col xs={24} lg={15}>
                <Card title="About this event" className="event-overview-card">
                  <Typography.Paragraph
                    className="event-summary"
                    {...(row.summary ? {} : { type: 'secondary' })}
                  >
                    {row.summary ?? 'No summary added yet.'}
                  </Typography.Paragraph>
                  {row.descriptionHtml && (
                    <div
                      className="event-rich-content event-description"
                      aria-label="Event description"
                      dangerouslySetInnerHTML={{ __html: safeDescriptionHtml(row.descriptionHtml) }}
                    />
                  )}
                  <Space wrap>
                    {row.tags.map((tag) => (
                      <Tag key={tag.id} color={tag.color}>
                        {tag.name}
                        {tag.active ? '' : ' (inactive)'}
                      </Tag>
                    ))}
                  </Space>
                </Card>
                {!row.deletedAt && (
                  <Card className="event-overview-card">
                    <EventGallery key={row.id} storeId={storeId} eventId={row.id} />
                  </Card>
                )}
                <Card title="Schedule & location">
                  <Descriptions
                    column={1}
                    items={[
                      {
                        key: 'start',
                        label: 'Starts',
                        children: `${eventTime(row.startsAt).format('DD MMM YYYY, HH:mm')} · Europe/Sofia`,
                      },
                      {
                        key: 'end',
                        label: 'Ends',
                        children: `${eventTime(row.endsAt).format('DD MMM YYYY, HH:mm')} · Europe/Sofia`,
                      },
                      {
                        key: 'registration',
                        label: 'Registration',
                        children:
                          row.registrationOpensOn && row.registrationClosesOn
                            ? `${row.registrationOpensOn} – ${row.registrationClosesOn}`
                            : 'Not configured',
                      },
                      ...(row.venue
                        ? [
                            {
                              key: 'venue',
                              label: 'Venue',
                              children: (
                                <div>
                                  <Typography.Text strong>{row.venue.name}</Typography.Text>
                                  {!row.venue.active && <Tag>Inactive</Tag>}
                                  <div>
                                    {[row.venue.address, row.venue.city, row.venue.countryCode]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </div>
                                </div>
                              ),
                            },
                          ]
                        : []),
                      ...(row.meetingUrl
                        ? [
                            {
                              key: 'meeting',
                              label: 'Meeting link',
                              children: (
                                <Typography.Link
                                  href={row.meetingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {row.meetingUrl}
                                </Typography.Link>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={9}>
                {!row.deletedAt && <EventSpeakers storeId={storeId} eventId={row.id} />}
                <Card title="Event details">
                  <Descriptions
                    column={1}
                    items={[
                      { key: 'code', label: 'Code', children: row.code },
                      {
                        key: 'format',
                        label: 'Format',
                        children: eventFormats.find(({ value }) => value === row.format)?.label,
                      },
                      {
                        key: 'capacity',
                        label: 'Capacity',
                        children: row.capacity?.toLocaleString() ?? 'Not set',
                      },
                      {
                        key: 'budget',
                        label: 'Budget',
                        children: row.budget
                          ? `${Number(row.budget).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`
                          : 'Not set',
                      },
                      { key: 'featured', label: 'Featured', children: row.featured ? 'Yes' : 'No' },
                      {
                        key: 'created',
                        label: 'Created',
                        children: `${eventTime(row.createdAt).format('DD MMM YYYY, HH:mm')} (Sofia)`,
                      },
                      {
                        key: 'updated',
                        label: 'Updated',
                        children: `${eventTime(row.updatedAt).format('DD MMM YYYY, HH:mm')} (Sofia)`,
                      },
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          )}
          <Link to={listPath}>
            <Button className="back-button">Back to events</Button>
          </Link>
          <Modal
            title="Move event to trash?"
            open={confirm}
            onCancel={() => {
              if (!pending) setConfirm(false);
            }}
            onOk={remove}
            okText="Move to trash"
            okButtonProps={{ danger: true }}
            confirmLoading={deletion.mutation.isPending}
            cancelButtonProps={{ disabled: pending }}
            closable={!pending}
            maskClosable={!pending}
          >
            <Typography.Paragraph>
              {row.title} will be removed from the active list.
            </Typography.Paragraph>
            {deletion.mutation.isError && (
              <Alert type="error" showIcon message={deletion.mutation.error.message} />
            )}
          </Modal>
        </>
      )}
    </>
  );
}
