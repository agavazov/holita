import isUUID from 'validator/lib/isUUID.js';
import { DataError } from '../data/data-error.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductDetailsFragment,
  ListProductsQueryVariables,
} from '../generated/graphql/operations.js';
import { prototypeStores } from './fixtures.js';
import type { PrototypePersistence } from './snapshot.js';
import { requireStore, validRecord, validText } from './validation.js';

function uuid(value: unknown, label: string) {
  if (typeof value !== 'string' || !isUUID(value)) throw new DataError(`${label} must be a UUID`);
  return value.toLowerCase();
}

function productText(value: unknown, label: string, max: number) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || Array.from(result).length > max)
    throw new DataError(`${label} must contain 1 to ${String(max)} characters after trimming`);
  if (result.includes('\u0000')) throw new DataError(`${label} contains an unsupported character`);
  return result;
}
function status(value: unknown): ProductDetailsFragment['status'] {
  if (value !== 'ACTIVE' && value !== 'DRAFT')
    throw new DataError('Status must be DRAFT or ACTIVE');
  return value;
}
export function validProduct(value: unknown): value is ProductDetailsFragment {
  return (
    validRecord(value) &&
    'name' in value &&
    validText(value.name, 200) &&
    'sku' in value &&
    validText(value.sku, 100) &&
    'status' in value &&
    (value.status === 'ACTIVE' || value.status === 'DRAFT')
  );
}
export function createProductState({ read, write }: PrototypePersistence) {
  function find(rows: ProductDetailsFragment[], storeId: string, id: unknown) {
    const recordId = uuid(id, 'Product ID');
    const row = rows.find((product) => product.storeId === storeId && product.id === recordId);
    if (!row) throw new DataError('Product not found');
    return row;
  }
  function unique(rows: ProductDetailsFragment[], row: ProductDetailsFragment) {
    if (
      rows.some(
        (previous) =>
          previous.storeId === row.storeId && previous.sku === row.sku && previous.id !== row.id,
      )
    )
      throw new DataError('A product with this SKU already exists in this store');
  }
  return {
    listProducts: (storeId: unknown, args: ListProductsQueryVariables) => {
      const store = uuid(storeId, 'x-store-id'),
        offset = args.offset ?? 0,
        limit = args.limit ?? 20;
      if (!Number.isInteger(offset) || offset < 0 || offset > 2147483647)
        throw new DataError('Offset must be an integer from 0 to 2147483647');
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new DataError('Limit must be an integer from 1 to 100');
      const search = args.search?.trim()
        ? productText(args.search, 'Search', 200).toLowerCase()
        : undefined;
      const sku = args.sku?.trim()
        ? productText(args.sku, 'SKU filter', 100).toLowerCase()
        : undefined;
      const selectedStatus = args.status == null ? undefined : status(args.status);
      const field = args.sort?.field ?? 'CREATED_AT',
        direction: unknown = args.sort?.direction ?? 'DESC';
      if (!['NAME', 'SKU', 'STATUS', 'CREATED_AT'].includes(field))
        throw new DataError('Sort field must be CREATED_AT, NAME, SKU or STATUS');
      if (direction !== 'ASC' && direction !== 'DESC')
        throw new DataError('Sort direction must be ASC or DESC');
      const rows = read().products.filter(
        (row) =>
          row.storeId === store &&
          (!search ||
            row.name.toLowerCase().includes(search) ||
            row.sku.toLowerCase().includes(search)) &&
          (!sku || row.sku.toLowerCase().includes(sku)) &&
          (!selectedStatus || row.status === selectedStatus),
      );
      rows.sort((left, right) => {
        const comparison =
          field === 'NAME'
            ? left.name.localeCompare(right.name)
            : field === 'SKU'
              ? left.sku.localeCompare(right.sku)
              : field === 'STATUS'
                ? left.status.localeCompare(right.status)
                : left.createdAt.localeCompare(right.createdAt);
        return comparison * (direction === 'ASC' ? 1 : -1) || right.id.localeCompare(left.id);
      });
      return { items: rows.slice(offset, offset + limit), total: rows.length, offset, limit };
    },
    getProduct: (storeId: unknown, id: unknown) => {
      const row = find(read().products, uuid(storeId, 'x-store-id'), id),
        store = prototypeStores.find((store) => store.id === row.storeId);
      if (!store) throw new DataError('Store not found');
      return { ...row, store: { ...store } };
    },
    createProduct: (storeId: unknown, input: CreateProductInput) => {
      const store = uuid(storeId, 'x-store-id'),
        snapshot = read(),
        now = new Date().toISOString();
      const row: ProductDetailsFragment = {
        id: crypto.randomUUID(),
        storeId: store,
        name: productText(input.name, 'Name', 200),
        sku: productText(input.sku, 'SKU', 100),
        status: status(input.status ?? 'DRAFT'),
        createdAt: now,
        updatedAt: now,
      };
      requireStore(store);
      unique(snapshot.products, row);
      write({ ...snapshot, products: [...snapshot.products, row] });
      return row;
    },
    updateProduct: (storeId: unknown, id: unknown, input: UpdateProductInput) => {
      const store = uuid(storeId, 'x-store-id'),
        recordId = uuid(id, 'Product ID'),
        snapshot = read();
      if (input.name === undefined && input.sku === undefined && input.status === undefined)
        throw new DataError('Provide at least one product field to update');
      const changes = {
        ...(input.name !== undefined ? { name: productText(input.name, 'Name', 200) } : {}),
        ...(input.sku !== undefined ? { sku: productText(input.sku, 'SKU', 100) } : {}),
        ...(input.status !== undefined ? { status: status(input.status) } : {}),
      };
      const row = {
        ...find(snapshot.products, store, recordId),
        ...changes,
        updatedAt: new Date().toISOString(),
      };
      unique(snapshot.products, row);
      write({
        ...snapshot,
        products: snapshot.products.map((product) => (product.id === row.id ? row : product)),
      });
      return row;
    },
    deleteProduct: (storeId: unknown, id: unknown) => {
      const snapshot = read(),
        row = find(snapshot.products, uuid(storeId, 'x-store-id'), id);
      write({
        ...snapshot,
        products: snapshot.products.filter((product) => product.id !== row.id),
      });
      return { id: row.id, storeId: row.storeId };
    },
  };
}
