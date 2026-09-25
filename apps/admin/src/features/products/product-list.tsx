import { useDelete, useList } from '@refinedev/core';
import { Alert, Button, Card, Empty, Input, Modal, Space, Table, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { productsResource, type DataError } from '../../data/data-provider.js';
import type {
  DeleteProductMutation,
  ProductDetailsFragment,
} from '../../generated/graphql/operations.js';

export function ProductList({ storeId, onDeleted }: { storeId: string; onDeleted: () => void }) {
  const resource = productsResource(storeId);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selected, setSelected] = useState<ProductDetailsFragment>();
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setAppliedSearch(search.trim());
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [search]);
  const filters = useMemo(
    () =>
      appliedSearch
        ? [{ field: 'search', operator: 'contains' as const, value: appliedSearch }]
        : [],
    [appliedSearch],
  );
  const products = useList<ProductDetailsFragment, DataError>({
    resource,
    pagination: { currentPage: page, pageSize, mode: 'server' },
    filters,
    errorNotification: false,
  });
  const deletion = useDelete<DeleteProductMutation['deleteProduct'], DataError>();
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
          if (products.result.data.length === 1 && page > 1) setPage(page - 1);
          onDeleted();
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }

  return (
    <Card
      title="Products"
      extra={
        <Button
          type="primary"
          onClick={() => {
            void navigate(`/${resource}/create`);
          }}
        >
          Create product
        </Button>
      }
    >
      <Input.Search
        allowClear
        aria-label="Search products"
        placeholder="Search by name or SKU"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
        style={{ marginBottom: 16, maxWidth: 400 }}
      />
      {products.query.isError && (
        <Alert
          className="form-error"
          type="error"
          showIcon
          message={products.query.error.message}
          action={
            <Button
              onClick={() => {
                void products.query.refetch();
              }}
            >
              Retry
            </Button>
          }
        />
      )}
      <Table<ProductDetailsFragment>
        rowKey="id"
        loading={products.query.isFetching}
        dataSource={products.query.isError ? [] : products.result.data}
        scroll={{ x: 650 }}
        locale={{
          emptyText:
            products.query.isPending || products.query.isError ? (
              'Products unavailable'
            ) : (
              <Empty
                description="No products in this store yet."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
        }}
        pagination={{
          current: page,
          pageSize,
          total: products.result.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (total) => `${String(total)} products`,
          onChange: (next, size) => {
            setPage(size === pageSize ? next : 1);
            setPageSize(size);
          },
        }}
        columns={[
          {
            title: 'Name',
            dataIndex: 'name',
            render: (_: unknown, product) => (
              <Link to={`/${resource}/${product.id}/edit`}>{product.name}</Link>
            ),
          },
          { title: 'SKU', dataIndex: 'sku' },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (_: unknown, product) => (
              <Tag color={product.status === 'ACTIVE' ? 'green' : 'default'}>
                {product.status === 'ACTIVE' ? 'Active' : 'Draft'}
              </Tag>
            ),
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, product) => (
              <Space>
                <Link to={`/${resource}/${product.id}/edit`}>Edit</Link>
                <Button
                  type="link"
                  danger
                  onClick={() => {
                    deletion.mutation.reset();
                    setSelected(product);
                  }}
                  aria-label={`Delete ${product.name}`}
                >
                  Delete
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title="Delete product?"
        open={Boolean(selected)}
        onCancel={() => {
          if (!deletion.mutation.isPending) setSelected(undefined);
        }}
        onOk={remove}
        okText="Delete product"
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
  );
}
