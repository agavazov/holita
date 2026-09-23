import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { Alert, Button, Card, Skeleton } from 'antd';
import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { productsResource, type DataError } from '../../data/data-provider.js';
import type {
  CreateProductInput,
  GetProductQuery,
  ProductDetailsFragment,
} from '../../generated/graphql/operations.js';
import { ProductForm } from './product-form.js';

type ProductEditorProps = { storeId: string; onSaved: () => void };

export function ProductEditor({ storeId, onSaved }: ProductEditorProps) {
  const { productId } = useParams();
  const navigate = useNavigate();
  const resource = productsResource(storeId);
  const submitting = useRef(false);
  const listPath = `/${resource}`;
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

  return (
    <Card title={productId ? 'Edit product' : 'Create product'} className="product-editor">
      {productId && product.query.isPending ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : productId && product.query.isError ? (
        <Alert
          type="error"
          showIcon
          message={product.query.error.message}
          action={
            <Button
              onClick={() => {
                void product.query.refetch();
              }}
            >
              Retry
            </Button>
          }
        />
      ) : (
        <ProductForm
          key={productId ?? 'create'}
          initialValues={productId ? product.result : undefined}
          pending={pending}
          error={create.mutation.error ?? update.mutation.error}
          onSubmit={save}
          onCancel={() => {
            void navigate(listPath);
          }}
        />
      )}
      {productId && product.query.isError && (
        <Button
          className="back-button"
          onClick={() => {
            void navigate(listPath);
          }}
        >
          Back to products
        </Button>
      )}
    </Card>
  );
}
