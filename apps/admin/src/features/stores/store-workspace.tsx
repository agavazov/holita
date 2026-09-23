import { useList } from '@refinedev/core';
import {
  Alert,
  Button,
  Card,
  Empty,
  Layout,
  Select,
  Skeleton,
  Space,
  Typography,
  notification,
} from 'antd';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';

import type { DataError } from '../../data/data-provider.js';
import type { ListStoresQuery } from '../../generated/graphql/operations.js';
import { ProductEditor } from '../products/product-editor.js';
import { ProductList } from '../products/product-list.js';

function StoreProducts({ storeId }: { storeId: string }) {
  const [api, holder] = notification.useNotification();
  const { pathname } = useLocation();
  return (
    <>
      {holder}
      <Routes key={pathname}>
        <Route
          index
          element={
            <ProductList
              storeId={storeId}
              onDeleted={() => {
                api.success({ message: 'Product deleted.' });
              }}
            />
          }
        />
        <Route
          path="create"
          element={
            <ProductEditor
              storeId={storeId}
              onSaved={() => {
                api.success({ message: 'Product saved.' });
              }}
            />
          }
        />
        <Route
          path=":productId/edit"
          element={
            <ProductEditor
              storeId={storeId}
              onSaved={() => {
                api.success({ message: 'Product saved.' });
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to={`/stores/${storeId}/products`} replace />} />
      </Routes>
    </>
  );
}

export function StoreWorkspace() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const stores = useList<ListStoresQuery['stores'][number], DataError>({
    resource: 'stores',
    pagination: { mode: 'off' },
    errorNotification: false,
  });
  const currentStore = stores.result.data.find((store) => store.id === storeId?.toLowerCase());

  return (
    <Layout className="app-layout">
      <Layout.Header className="app-header">
        <Typography.Text strong className="brand">
          holita
        </Typography.Text>
        <Space wrap>
          <label htmlFor="store-switcher">Store</label>
          <Select
            id="store-switcher"
            className="store-switcher"
            aria-label="Store"
            placeholder="Select a store"
            loading={stores.query.isFetching}
            value={currentStore?.id ?? null}
            options={stores.result.data.map((store) => ({ value: store.id, label: store.name }))}
            onChange={(id: string) => {
              void navigate(`/stores/${id}/products`);
            }}
          />
        </Space>
      </Layout.Header>
      <Layout.Content className="app-content">
        {stores.query.isPending ? (
          <Card>
            <Skeleton active />
          </Card>
        ) : stores.query.isError ? (
          <Alert
            type="error"
            showIcon
            message="Could not load stores."
            description={stores.query.error.message}
            action={
              <Button
                onClick={() => {
                  void stores.query.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        ) : currentStore ? (
          <>
            <Typography.Title level={2}>{currentStore.name}</Typography.Title>
            <StoreProducts key={currentStore.id} storeId={currentStore.id} />
          </>
        ) : (
          <Card title={storeId ? 'Store not found' : 'Select a store'}>
            {stores.result.data.length === 0 ? (
              <Empty description="No stores available. Ask your workspace administrator to set up a store." />
            ) : (
              <>
                <Typography.Paragraph>
                  {storeId
                    ? 'Choose an available store to continue.'
                    : 'Choose a store to manage its products.'}
                </Typography.Paragraph>
                <Space wrap>
                  {stores.result.data.map((store) => (
                    <Button
                      key={store.id}
                      onClick={() => {
                        void navigate(`/stores/${store.id}/products`);
                      }}
                    >
                      {store.name}
                    </Button>
                  ))}
                </Space>
              </>
            )}
          </Card>
        )}
      </Layout.Content>
    </Layout>
  );
}
