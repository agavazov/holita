import type { CreateParams, CrudFilters, DataProvider, UpdateParams } from '@refinedev/core';
import createGraphQLProvider from '@refinedev/graphql';
import { Client, fetchExchange, type OperationResult } from '@urql/core';

import {
  CreateProductDocument,
  DeleteProductDocument,
  GetProductDocument,
  ListProductsDocument,
  ListStoresDocument,
  UpdateProductDocument,
  type CreateProductInput,
  type CreateProductMutation,
  type CreateProductMutationVariables,
  type DeleteProductMutation,
  type DeleteProductMutationVariables,
  type GetProductQuery,
  type GetProductQueryVariables,
  type ListProductsQuery,
  type ListProductsQueryVariables,
  type ListStoresQuery,
  type UpdateProductInput,
  type UpdateProductMutation,
  type UpdateProductMutationVariables,
} from '../generated/graphql/operations.js';

export class DataError extends Error {
  readonly statusCode = 400;

  constructor(
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'DataError';
  }
}

export function productsResource(storeId: string) {
  return `stores/${storeId.toLowerCase()}/products`;
}

function storeContext(resource: string) {
  if (resource === 'stores') return undefined;
  const match =
    /^stores\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/products$/i.exec(
      resource,
    );
  if (!match?.[1]) throw new DataError('Select a valid store before accessing products.');
  return match[1].toLowerCase();
}

function requireData<T>(response: OperationResult<T>): T {
  if (!response.data) throw new DataError('The gateway returned no data.');
  return response.data;
}

function productSearch(filters?: CrudFilters) {
  const filter = filters?.find((candidate) => 'field' in candidate && candidate.field === 'search');
  if (!filter || !('value' in filter) || typeof filter.value !== 'string') return undefined;
  return filter.value.trim() || undefined;
}

export function createDataProvider(url: string): DataProvider {
  async function request<T>(
    resource: string,
    execute: (provider: DataProvider) => Promise<T>,
  ): Promise<T> {
    const storeId = storeContext(resource);
    const requestId = crypto.randomUUID();
    // A transport instance captures this request's scope. Refine owns the only cache.
    const client = new Client({
      url,
      exchanges: [fetchExchange],
      fetchOptions: {
        headers: { 'x-request-id': requestId, ...(storeId ? { 'x-store-id': storeId } : {}) },
        signal: AbortSignal.timeout(10_000),
      },
    });
    const provider = createGraphQLProvider(client, {
      getList: {
        buildVariables: ({ pagination, filters }): ListProductsQueryVariables => ({
          offset: ((pagination?.currentPage ?? 1) - 1) * (pagination?.pageSize ?? 20),
          limit: pagination?.pageSize ?? 20,
          search: productSearch(filters),
        }),
        dataMapper: (response: OperationResult<ListStoresQuery | ListProductsQuery>) => {
          const data = requireData(response);
          return 'stores' in data ? data.stores : data.products.items;
        },
        getTotalCount: (response: OperationResult<ListStoresQuery | ListProductsQuery>) => {
          const data = requireData(response);
          return 'stores' in data ? data.stores.length : data.products.total;
        },
      },
      getOne: {
        buildVariables: ({ id }): GetProductQueryVariables => ({ id: String(id) }),
        dataMapper: (response: OperationResult<GetProductQuery>) => requireData(response).product,
      },
      create: {
        buildVariables: ({
          variables,
        }: CreateParams<CreateProductInput>): CreateProductMutationVariables => ({
          input: variables,
        }),
        dataMapper: (response: OperationResult<CreateProductMutation>) =>
          requireData(response).createProduct,
      },
      update: {
        buildVariables: ({
          id,
          variables,
        }: UpdateParams<UpdateProductInput>): UpdateProductMutationVariables => ({
          id: String(id),
          input: variables,
        }),
        dataMapper: (response: OperationResult<UpdateProductMutation>) =>
          requireData(response).updateProduct,
      },
      deleteOne: {
        buildVariables: ({ id }): DeleteProductMutationVariables => ({ id: String(id) }),
        dataMapper: (response: OperationResult<DeleteProductMutation>) =>
          requireData(response).deleteProduct,
      },
    });
    try {
      return await execute(provider);
    } catch (error) {
      const message =
        error instanceof Error && error.message.startsWith('[GraphQL] ')
          ? error.message.slice('[GraphQL] '.length)
          : 'Could not reach the gateway. Please try again.';
      throw new DataError(message, requestId);
    }
  }

  function productRequest<T>(resource: string, execute: (provider: DataProvider) => Promise<T>) {
    if (resource === 'stores') throw new DataError('Stores are read-only.');
    return request(resource, execute);
  }

  return {
    getApiUrl: () => url,
    getList: (params) =>
      request(params.resource, (provider) =>
        provider.getList({
          ...params,
          meta: {
            gqlQuery: params.resource === 'stores' ? ListStoresDocument : ListProductsDocument,
          },
        }),
      ),
    getOne: (params) =>
      productRequest(params.resource, (provider) =>
        provider.getOne({ ...params, meta: { gqlQuery: GetProductDocument } }),
      ),
    create: (params) =>
      productRequest(params.resource, (provider) =>
        provider.create({ ...params, meta: { gqlMutation: CreateProductDocument } }),
      ),
    update: (params) =>
      productRequest(params.resource, (provider) =>
        provider.update({ ...params, meta: { gqlMutation: UpdateProductDocument } }),
      ),
    deleteOne: (params) =>
      productRequest(params.resource, (provider) =>
        provider.deleteOne({ ...params, meta: { gqlMutation: DeleteProductDocument } }),
      ),
  };
}
