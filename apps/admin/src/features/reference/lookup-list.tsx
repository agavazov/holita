import { useDelete, useList } from '@refinedev/core';
import { Alert, Breadcrumb, Button, Card, Empty, Modal, Space, Table, Tag, Typography } from 'antd';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import type { TableColumnsType } from 'antd';
import type { DataError } from '../../data/data-provider.js';
import type { ReferenceVenueDetailsFragment } from '../../generated/graphql/operations.js';

type LookupRow = Pick<ReferenceVenueDetailsFragment, 'id' | 'name' | 'active'>;

// Shared listing UI for Reference's three supporting entities; forms and API mappings stay concrete.
export function LookupList<T extends LookupRow>({
  resource,
  title,
  singular,
  columns,
  onDeleted,
}: {
  resource: string;
  title: string;
  singular: string;
  columns: TableColumnsType<T>;
  onDeleted: () => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<T>();
  const records = useList<T, DataError>({
    resource,
    pagination: { currentPage: page, pageSize, mode: 'server' },
    errorNotification: false,
  });
  const deletion = useDelete<{ id: string }, DataError>();
  const submitting = useRef(false);

  function remove() {
    if (!selected || submitting.current) return;
    submitting.current = true;
    deletion.mutate(
      {
        resource,
        id: selected.id,
        mutationMode: 'pessimistic',
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setSelected(undefined);
          if (records.result.data.length === 1 && page > 1) setPage(page - 1);
          onDeleted();
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }

  return (
    <>
      <Breadcrumb className="page-breadcrumb" items={[{ title: 'Reference' }, { title }]} />
      <Card
        className="page-header"
        title={title}
        extra={
          <Link to={`/${resource}/create`}>
            <Button type="primary">Create {singular}</Button>
          </Link>
        }
      >
        <Typography.Text type="secondary">
          {records.query.isPending
            ? `Loading ${title.toLowerCase()}…`
            : records.query.isError
              ? `${title} unavailable`
              : `${String(records.result.total ?? 0)} ${records.result.total === 1 ? singular : title.toLowerCase()} in this store`}
        </Typography.Text>
      </Card>
      <Card>
        {records.query.isError && (
          <Alert
            className="form-error"
            type="error"
            showIcon
            message={records.query.error.message}
            action={
              <Button
                onClick={() => {
                  void records.query.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        )}
        <Table<T>
          rowKey="id"
          loading={records.query.isFetching}
          dataSource={records.query.isError ? [] : records.result.data}
          scroll={{ x: 650 }}
          locale={{
            emptyText: records.query.isPending ? (
              `Loading ${title.toLowerCase()}…`
            ) : records.query.isError ? (
              `${title} unavailable`
            ) : (
              <Empty
                description={`No ${title.toLowerCase()} in this store yet.`}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: records.result.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `${String(total)} ${title.toLowerCase()}`,
            onChange: (next, size) => {
              setPage(size === pageSize ? next : 1);
              setPageSize(size);
            },
          }}
          columns={[
            {
              title: 'Name',
              dataIndex: 'name',
              render: (_: unknown, record) => (
                <Link to={`/${resource}/${record.id}/edit`}>{record.name}</Link>
              ),
            },
            ...columns,
            {
              title: 'Status',
              dataIndex: 'active',
              render: (_: unknown, record) => (
                <Tag color={record.active ? 'green' : 'default'}>
                  {record.active ? 'Active' : 'Inactive'}
                </Tag>
              ),
            },
            {
              title: 'Actions',
              key: 'actions',
              render: (_: unknown, record) => (
                <Space>
                  <Link to={`/${resource}/${record.id}/edit`}>Edit</Link>
                  <Button
                    type="link"
                    danger
                    onClick={() => {
                      deletion.mutation.reset();
                      setSelected(record);
                    }}
                    aria-label={`Delete ${record.name}`}
                  >
                    Delete
                  </Button>
                </Space>
              ),
            },
          ]}
        />
        <Modal
          title={`Delete ${singular}?`}
          open={Boolean(selected)}
          onCancel={() => {
            if (!deletion.mutation.isPending) setSelected(undefined);
          }}
          onOk={remove}
          okText={`Delete ${singular}`}
          okButtonProps={{ danger: true }}
          confirmLoading={deletion.mutation.isPending}
          cancelButtonProps={{ disabled: deletion.mutation.isPending }}
          closable={!deletion.mutation.isPending}
          maskClosable={!deletion.mutation.isPending}
        >
          <Typography.Paragraph>
            Delete <Typography.Text strong>{selected?.name}</Typography.Text> from this store? This
            cannot be undone.
          </Typography.Paragraph>
          {deletion.mutation.error && (
            <Alert type="error" showIcon message={deletion.mutation.error.message} />
          )}
        </Modal>
      </Card>
    </>
  );
}
