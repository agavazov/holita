import { useTranslation } from 'react-i18next';
import { useLocalizedNavigate, useLocalizedPath, useLanguage } from '../../i18n/routing.js';
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
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useList, useTranslation as useRefineTranslation } from '@refinedev/core';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';

import type { DataError } from '../../data/data-provider.js';
import type { ListStoresQuery } from '../../generated/graphql/operations.js';
import { AdminLayout } from '../../layout/admin-layout.js';
import { ProductEditor } from '../products/product-editor.js';
import { ProductList } from '../products/product-list.js';
import { PageHeader } from '../../components/page-header.js';
import { QueryRefreshWarning } from '../../components/query-refresh-warning.js';
import type { DataSource } from '../../config.js';
import { defaultSection, sectionAvailable, workspaceNavigation } from '../../navigation.js';

const ReferenceWorkspace = lazy(async () => {
  const module = await import('../reference/reference-workspace.js');
  return { default: module.ReferenceWorkspace };
});

const UiCatalog = lazy(async () => {
  const module = await import('../prototype/ui-catalog/ui-catalog.js');
  return { default: module.UiCatalog };
});

function StoreProducts({ storeId }: { storeId: string }) {
  const { t } = useTranslation('products');
  const localize = useLocalizedPath();
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
                setNotice(t('messages.deleted', { count }));
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
                setNotice(t('messages.saved'));
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
                setNotice(t('messages.saved'));
              }}
            />
          }
        />
        <Route
          path="*"
          element={<Navigate to={localize(`/stores/${storeId}/products`)} replace />}
        />
      </Routes>
    </>
  );
}

export function StoreWorkspace({
  referenceEnabled = true,
  dataSource = 'graphql',
  controls,
}: {
  referenceEnabled?: boolean;
  dataSource?: DataSource;
  controls?: ReactNode;
}) {
  const { t } = useTranslation(['shell', 'products', 'reference', 'prototype', 'stores', 'common']);
  const { storeId } = useParams();
  const language = useLanguage();
  const { changeLocale } = useRefineTranslation();
  const { pathname: localizedPathname } = useLocation();
  const pathname = localizedPathname.replace(/^\/(bg|en)(?=\/|$)/, '') || '/';
  const isCatalog = pathname.split('/')[3] === 'ui-catalog';
  const isReference = pathname.includes('/reference/');
  const referenceSection = pathname.split('/')[4];
  const section = isCatalog
    ? 'ui-catalog'
    : isReference &&
        referenceEnabled &&
        referenceSection &&
        (dataSource === 'mock' ||
          ['events', 'venues', 'speakers', 'tags'].includes(referenceSection))
      ? `reference/${referenceSection}`
      : pathname === '/'
        ? defaultSection(dataSource)
        : 'products';
  const navigate = useLocalizedNavigate();
  const stores = useList<ListStoresQuery['stores'][number], DataError>({
    resource: 'stores',
    pagination: { mode: 'off' },
    errorNotification: false,
  });
  const currentStore = stores.result.data.find((store) => store.id === storeId?.toLowerCase());

  return (
    <AdminLayout
      language={language}
      onLanguageChange={(nextLanguage) => {
        void changeLocale(nextLanguage);
      }}
      stores={stores.result.data}
      selectedStoreId={currentStore?.id ?? null}
      storesLoading={stores.query.isFetching}
      selectedSection={section}
      modeLabel={dataSource === 'mock' ? t('prototype:mode') : t('modes.real')}
      controls={controls}
      navigationGroups={workspaceNavigation(dataSource, referenceEnabled, t)}
      onStoreChange={(id) => {
        void navigate(
          `/stores/${id}/${sectionAvailable(dataSource, section) ? section : defaultSection(dataSource)}`,
        );
      }}
      onSectionChange={(nextSection) => {
        if (currentStore) void navigate(`/stores/${currentStore.id}/${nextSection}`);
      }}
    >
      {stores.query.isRefetchError && (
        <QueryRefreshWarning
          message={stores.query.error.message}
          refreshing={stores.query.isFetching}
          onRetry={() => {
            void stores.query.refetch();
          }}
        />
      )}
      {stores.query.isPending ? (
        <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
          <Typography role="status" sx={{ mb: 3 }}>
            {t('stores:loading')}
          </Typography>
          <Skeleton variant="rounded" height={160} />
        </Paper>
      ) : stores.query.isLoadingError ? (
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
                {t('common:actions.retry')}
              </Button>
            }
          >
            <AlertTitle>{t('stores:loadError')}</AlertTitle>
            {stores.query.error.message}
          </Alert>
        </Paper>
      ) : currentStore ? (
        <>
          {!sectionAvailable(dataSource, section) ? (
            <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
              <Alert severity="info">
                {dataSource === 'mock'
                  ? t('stores:sections.prototypeUnavailable')
                  : t('stores:sections.catalogOnlyPrototype')}
              </Alert>
              <Button
                sx={{ mt: 2 }}
                onClick={() => {
                  void navigate(`/stores/${currentStore.id}/${defaultSection(dataSource)}`);
                }}
              >
                {dataSource === 'mock'
                  ? t('stores:sections.openTags')
                  : t('stores:sections.openProducts')}
              </Button>
            </Paper>
          ) : isCatalog ? (
            <Suspense
              fallback={
                <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
                  <Typography role="status">{t('stores:sections.loadingCatalog')}</Typography>
                  <Skeleton variant="rounded" height={300} />
                </Paper>
              }
            >
              <UiCatalog key={currentStore.id} />
            </Suspense>
          ) : isReference ? (
            referenceEnabled ? (
              <Suspense
                fallback={
                  <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
                    <Typography role="status" sx={{ mb: 3 }}>
                      {t('stores:sections.loadingReference')}
                    </Typography>
                    <Skeleton variant="rounded" height={300} />
                  </Paper>
                }
              >
                <ReferenceWorkspace
                  key={currentStore.id}
                  storeId={currentStore.id}
                  storeName={currentStore.name}
                />
              </Suspense>
            ) : (
              <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
                <Alert severity="info">{t('stores:sections.referenceDisabled')}</Alert>
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
            title={storeId ? t('stores:notFound') : t('stores:select')}
            breadcrumbs={[{ label: t('common:home'), to: '/' }, { label: t('stores:title') }]}
          />
          {stores.result.data.length === 0 ? (
            <Typography color="text.secondary">{t('stores:empty')}</Typography>
          ) : (
            <>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                {storeId
                  ? t('stores:chooseAvailable')
                  : dataSource === 'mock'
                    ? t('stores:choosePrototype')
                    : t('stores:chooseProducts')}
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
                      void navigate(`/stores/${store.id}/${defaultSection(dataSource)}`);
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
