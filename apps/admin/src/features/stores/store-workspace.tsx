import { useList } from '@refinedev/core';
import {
  Alert,
  Button,
  Card,
  Empty,
  Drawer,
  Grid,
  Layout,
  Menu,
  Select,
  Skeleton,
  Space,
  Typography,
  notification,
} from 'antd';
import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';

import type { DataError } from '../../data/data-provider.js';
import type { ListStoresQuery } from '../../generated/graphql/operations.js';
import { ProductEditor } from '../products/product-editor.js';
import { ProductList } from '../products/product-list.js';
import { ReferenceWorkspace } from '../reference/reference-workspace.js';

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

export function StoreWorkspace({ referenceEnabled = true }: { referenceEnabled?: boolean }) {
  const { storeId } = useParams();
  const screens = Grid.useBreakpoint();
  const compact = screens.lg === false;
  const [navigationOpen, setNavigationOpen] = useState(false);
  const { pathname } = useLocation();
  const isReference = pathname.includes('/reference/');
  const referenceSection = pathname.split('/')[4];
  const section =
    isReference &&
    referenceEnabled &&
    ['events', 'venues', 'speakers', 'tags'].includes(referenceSection ?? '')
      ? `reference/${referenceSection ?? 'events'}`
      : 'products';
  const navigate = useNavigate();
  const stores = useList<ListStoresQuery['stores'][number], DataError>({
    resource: 'stores',
    pagination: { mode: 'off' },
    errorNotification: false,
  });
  const currentStore = stores.result.data.find((store) => store.id === storeId?.toLowerCase());

  const navigation = currentStore ? (
    <Menu
      mode="inline"
      selectedKeys={[section]}
      items={[
        { key: 'products', label: 'Products' },
        ...(referenceEnabled
          ? [
              {
                key: 'reference',
                type: 'group' as const,
                label: 'Reference',
                children: [
                  { key: 'reference/events', label: 'Events' },
                  { key: 'reference/venues', label: 'Venues' },
                  { key: 'reference/speakers', label: 'Speakers' },
                  { key: 'reference/tags', label: 'Tags' },
                ],
              },
            ]
          : []),
      ]}
      onClick={({ key }) => {
        setNavigationOpen(false);
        void navigate(`/stores/${currentStore.id}/${key}`);
      }}
    />
  ) : null;

  return (
    <Layout className="app-layout">
      <Layout.Header className="app-header">
        <Space>
          {currentStore && compact && (
            <Button
              aria-label="Open navigation"
              onClick={() => {
                setNavigationOpen(true);
              }}
            >
              Menu
            </Button>
          )}
          <Typography.Text strong className="brand">
            holita
          </Typography.Text>
        </Space>
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
              void navigate(`/stores/${id}/${section}`);
            }}
          />
        </Space>
      </Layout.Header>
      <Drawer
        title="Navigation"
        placement="left"
        width={260}
        open={compact && navigationOpen}
        onClose={() => {
          setNavigationOpen(false);
        }}
      >
        {compact && navigation}
      </Drawer>
      <Layout className="workspace-body">
        {currentStore && (
          <Layout.Sider
            width={184}
            breakpoint="lg"
            collapsedWidth={0}
            trigger={null}
            className="app-sidebar"
            theme="light"
          >
            {!compact && navigation}
          </Layout.Sider>
        )}
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
              {isReference ? (
                referenceEnabled ? (
                  <ReferenceWorkspace
                    key={currentStore.id}
                    storeId={currentStore.id}
                    storeName={currentStore.name}
                  />
                ) : (
                  <Alert type="info" showIcon message="Reference is disabled." />
                )
              ) : (
                <>
                  <Typography.Title level={2}>{currentStore.name}</Typography.Title>
                  <StoreProducts key={currentStore.id} storeId={currentStore.id} />
                </>
              )}
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
    </Layout>
  );
}
