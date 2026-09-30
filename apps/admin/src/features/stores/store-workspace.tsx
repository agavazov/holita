import {
  Alert,
  AlertTitle,
  Button,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useList } from '@refinedev/core';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';

import type { DataError } from '../../data/data-provider.js';
import type { ListStoresQuery } from '../../generated/graphql/operations.js';
import { AdminLayout } from '../../layout/admin-layout.js';
import { ProductEditor } from '../products/product-editor.js';
import { ProductList } from '../products/product-list.js';
import { ReferenceWorkspace } from '../reference/reference-workspace.js';
import { PageHeader } from '../../components/page-header.js';

function StoreProducts({ storeId }: { storeId: string }) {
  const [notice, setNotice] = useState('');
  const { pathname } = useLocation();
  return (
    <>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setNotice('');
        }}
      >
        <Alert
          severity="success"
          onClose={() => {
            setNotice('');
          }}
        >
          {notice}
        </Alert>
      </Snackbar>
      <Routes key={pathname}>
        <Route
          index
          element={
            <ProductList
              storeId={storeId}
              onDeleted={(count) => {
                setNotice(count === 1 ? 'Product deleted.' : `${String(count)} products deleted.`);
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
                setNotice('Product saved.');
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
                setNotice('Product saved.');
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
        <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
          <Typography role="status" sx={{ mb: 3 }}>
            Loading stores…
          </Typography>
          <Skeleton variant="rounded" height={160} />
        </Paper>
      ) : stores.query.isError ? (
        <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
          <Alert
            severity="error"
            sx={{ overflowWrap: 'anywhere' }}
            action={
              <Button
                color="inherit"
                sx={{ whiteSpace: 'nowrap' }}
                onClick={() => {
                  void stores.query.refetch();
                }}
              >
                Retry
              </Button>
            }
          >
            <AlertTitle>Could not load stores.</AlertTitle>
            {stores.query.error.message}
          </Alert>
        </Paper>
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
              <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
                <Alert severity="info">Reference is disabled.</Alert>
              </Paper>
            )
          ) : (
            <StoreProducts key={currentStore.id} storeId={currentStore.id} />
          )}
        </>
      ) : (
        <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
          <PageHeader
            embedded
            title={storeId ? 'Store not found' : 'Select a store'}
            breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Stores' }]}
          />
          {stores.result.data.length === 0 ? (
            <Typography color="text.secondary">
              No stores available. Ask your workspace administrator to set up a store.
            </Typography>
          ) : (
            <>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                {storeId
                  ? 'Choose an available store to continue.'
                  : 'Choose a store to manage its products.'}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                sx={{ gap: 2, flexWrap: 'wrap', alignItems: { sm: 'flex-start' } }}
              >
                {stores.result.data.map((store) => (
                  <Button
                    key={store.id}
                    variant="soft"
                    color="neutral"
                    sx={{ minWidth: 184, overflowWrap: 'anywhere' }}
                    onClick={() => {
                      void navigate(`/stores/${store.id}/products`);
                    }}
                  >
                    {store.name}
                  </Button>
                ))}
              </Stack>
            </>
          )}
        </Paper>
      )}
    </AdminLayout>
  );
}
