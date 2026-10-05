import type { CreateParams, UpdateParams } from '@refinedev/core';
import type { GraphQLDataProviderOptions } from '@refinedev/graphql';
import type { OperationResult } from '@urql/core';
import { requireData } from './provider-utils.js';
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
export const productsOptions: GraphQLDataProviderOptions = {
  getList: {
    buildVariables: ({ pagination, filters, sorters }): ListProductsQueryVariables => {
      const variables: ListProductsQueryVariables = {
        offset: ((pagination?.currentPage ?? 1) - 1) * (pagination?.pageSize ?? 20),
        limit: pagination?.pageSize ?? 20,
      };
      for (const filter of filters ?? []) {
        if (!('field' in filter)) continue;
        const value: unknown = filter.value;
        if (filter.field === 'search' && typeof value === 'string' && value)
          variables.search = value;
        if (filter.field === 'sku' && typeof value === 'string' && value) variables.sku = value;
        if (filter.field === 'status' && (value === 'ACTIVE' || value === 'DRAFT'))
          variables.status = value;
      }
      const sorter = sorters?.[0];
      if (sorter) {
        const field =
          sorter.field === 'name'
            ? 'NAME'
            : sorter.field === 'sku'
              ? 'SKU'
              : sorter.field === 'status'
                ? 'STATUS'
                : undefined;
        if (field) variables.sort = { field, direction: sorter.order === 'asc' ? 'ASC' : 'DESC' };
      }
      return variables;
    },
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
};
export const productsDocuments = {
  list: ListProductsDocument,
  one: GetProductDocument,
  create: CreateProductDocument,
  update: UpdateProductDocument,
  delete: DeleteProductDocument,
};
export { ListStoresDocument };
