import { useList } from '@refinedev/core';
import { Alert, Button, Card, Empty, Skeleton, Space, Typography, notification } from 'antd';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';

import type { DataError } from '../../data/data-provider.js';
import type { ListStoresQuery } from '../../generated/graphql/operations.js';
import { AdminLayout } from '../../layout/admin-layout.js';
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

  return (
    <AdminLayout
      stores={stores.result.data}
      selectedStoreId={currentStore?.id ?? null}
      storesLoading={stores.query.isFetching}
      selectedSection={section}
      navigationGroups={[
        {
          key: 'workspace',
          label: 'Workspace',
          icon: 'material-symbols:dashboard-customize-outline-rounded',
          items: [
            {
              key: 'products',
              label: 'Products',
              icon: 'material-symbols:inventory-2-outline-rounded',
            },
          ],
        },
        ...(referenceEnabled
          ? [
              {
                key: 'reference',
                label: 'Reference',
                icon: 'material-symbols:widgets-outline-rounded' as const,
                items: [
                  {
                    key: 'reference/events',
                    label: 'Events',
                    icon: 'material-symbols:calendar-month-outline-rounded' as const,
                  },
                  {
                    key: 'reference/venues',
                    label: 'Venues',
                    icon: 'material-symbols:location-on-outline-rounded' as const,
                  },
                  {
                    key: 'reference/speakers',
                    label: 'Speakers',
                    icon: 'material-symbols:person-outline-rounded' as const,
                  },
                  {
                    key: 'reference/tags',
                    label: 'Tags',
                    icon: 'material-symbols:label-important-outline-rounded' as const,
                  },
                ],
              },
            ]
          : []),
      ]}
      onStoreChange={(id) => {
        void navigate(`/stores/${id}/${section}`);
      }}
      onSectionChange={(nextSection) => {
        if (currentStore) void navigate(`/stores/${currentStore.id}/${nextSection}`);
      }}
    >
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
    </AdminLayout>
  );
}
