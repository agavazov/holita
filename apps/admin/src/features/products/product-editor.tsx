import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Box, Button, Skeleton, Stack } from '@mui/material';
import { PageHeader } from '../../components/page-header.js';
import { QueryRefreshWarning } from '../../components/query-refresh-warning.js';
import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { productsResource, type DataError } from '../../data/data-provider.js';
import type {
  CreateProductInput,
  GetProductQuery,
  ProductDetailsFragment,
} from '../../generated/graphql/operations.js';
import { useLocalization } from '../../localization/localization-provider.js';
import { localizedPath } from '../../localization/locale.js';
import { ProductForm } from './product-form.js';

type ProductEditorProps = { storeId: string; onSaved: () => void };

export function ProductEditor({ storeId, onSaved }: ProductEditorProps) {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { locale, t } = useLocalization();
  const resource = productsResource(storeId);
  const submitting = useRef(false);
  const listPath = localizedPath(locale, `/${resource}`);
  const product = useOne<GetProductQuery['product'], DataError>({
    resource,
    ...(productId ? { id: productId } : {}),
    queryOptions: { enabled: Boolean(productId) },
    errorNotification: false,
  });
  const create = useCreate<ProductDetailsFragment, DataError, CreateProductInput>({
    successNotification: false,
    errorNotification: false,
  });
  const update = useUpdate<ProductDetailsFragment, DataError, CreateProductInput>({
    successNotification: false,
    errorNotification: false,
    mutationMode: 'pessimistic',
  });
  const pending = create.mutation.isPending || update.mutation.isPending;

  function save(values: CreateProductInput) {
    if (submitting.current) return;
    submitting.current = true;
    // Per-call callbacks belong to this mounted editor. Refine invalidates the captured resource.
    const callbacks = {
      onSuccess: () => {
        onSaved();
        void navigate(listPath);
      },
      onSettled: () => {
        submitting.current = false;
      },
    };
    if (productId) update.mutate({ resource, id: productId, values }, callbacks);
    else create.mutate({ resource, values }, callbacks);
  }

  const header = (
    <PageHeader
      embedded
      title={productId ? t('products.edit') : t('products.create')}
      breadcrumbs={[
        { label: t('common.home'), to: localizedPath(locale, '/') },
        { label: t('shell.products'), to: listPath },
        { label: productId ? t('products.edit') : t('products.create') },
      ]}
    />
  );

  return (
    <Stack sx={{ flex: 1, minWidth: 0 }}>
      {productId && product.query.isRefetchError && (
        <QueryRefreshWarning
          message={t('common.genericError')}
          refreshing={product.query.isFetching}
          onRetry={() => {
            void product.query.refetch();
          }}
        />
      )}
      {productId && (product.query.isPending || product.query.isLoadingError) && (
        <Box sx={{ p: { xs: 3, md: 5 } }}>{header}</Box>
      )}
      {productId && product.query.isPending ? (
        <Box sx={{ p: 5 }}>
          <Skeleton height={60} />
          <Skeleton height={200} />
        </Box>
      ) : productId && product.query.isLoadingError ? (
        <Alert
          severity="error"
          sx={{ m: 3 }}
          action={
            <Button
              onClick={() => {
                void product.query.refetch();
              }}
            >
              {t('common.retry')}
            </Button>
          }
        >
          {t('common.genericError')}
        </Alert>
      ) : (
        <ProductForm
          header={header}
          initialValues={productId ? product.result : undefined}
          pending={pending}
          error={create.mutation.error ?? update.mutation.error}
          onSubmit={save}
          onCancel={() => {
            void navigate(listPath);
          }}
        />
      )}
      {productId && product.query.isLoadingError && (
        <Button
          sx={{ m: 3, alignSelf: 'flex-start' }}
          onClick={() => {
            void navigate(listPath);
          }}
        >
          {t('products.back')}
        </Button>
      )}
    </Stack>
  );
}
