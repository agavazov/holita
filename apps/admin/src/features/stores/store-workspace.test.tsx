import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { App } from '../../App.js';
import { createDataProvider } from '../../data/data-provider.js';
import {
  deferredResponse,
  mockGraphQL,
  product,
  result,
  storeA,
  storeB,
  stores,
  type GraphQLCall,
} from '../../test/graphql-fixture.js';

function Location() {
  const location = useLocation();
  return (
    <>
      <output aria-label="Current route">{location.pathname}</output>
      <Link to={`/stores/${storeA}/products/create`}>Open another editor</Link>
    </>
  );
}
function mount(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App dataProvider={createDataProvider('http://127.0.0.1:11080/graphql')} />
      <Location />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
async function switchStore(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('combobox', { name: 'Store' }));
  await user.click(await screen.findByText(name, { selector: '.ant-select-item-option-content' }));
}
function defaultResult(call: GraphQLCall) {
  if (call.operation === 'ListStores') return result({ stores });
  const row = call.storeId === storeB ? product(storeB, 'Plovdiv notebook') : product();
  if (call.operation === 'GetProduct')
    return result({
      product: { ...row, store: stores.find((store) => store.id === call.storeId) },
    });
  return result({ products: { items: [row], total: 1, offset: 0, limit: 20 } });
}

describe('store-scoped Products UI', () => {
  it('selects a store before fetching products and paginates the selected store', async () => {
    const transport = mockGraphQL((call) =>
      call.operation === 'ListProducts'
        ? result({
            products: {
              items: [
                product(
                  storeA,
                  call.variables.offset === 20 ? 'Second page product' : 'First page product',
                ),
              ],
              total: 21,
              offset: call.variables.offset,
              limit: 20,
            },
          })
        : defaultResult(call),
    );
    const user = mount();
    await screen.findByRole('button', { name: 'Sofia Store' });
    expect(transport.calls.map((call) => call.operation)).toEqual(['ListStores']);
    await user.click(screen.getByRole('button', { name: 'Sofia Store' }));
    expect(await screen.findByText('First page product')).toBeInTheDocument();
    await user.click(screen.getByTitle('Next Page'));
    expect(await screen.findByText('Second page product')).toBeInTheDocument();
    expect(transport.calls.at(-1)).toMatchObject({
      storeId: storeA,
      variables: { offset: 20, limit: 20 },
    });
  });

  it('debounces search, resets pagination and discards searched results on store switch', async () => {
    const delayedSearch = deferredResponse();
    const transport = mockGraphQL((call) => {
      if (call.operation !== 'ListProducts') return defaultResult(call);
      if (call.storeId === storeA && call.variables.search === 'note') return delayedSearch.promise;
      const row =
        call.storeId === storeB
          ? product(storeB, 'Plovdiv notebook')
          : product(
              storeA,
              call.variables.offset === 20 ? 'Second page product' : 'First page product',
            );
      return result({
        products: {
          items: [row],
          total: call.storeId === storeA ? 21 : 1,
          offset: call.variables.offset,
          limit: 20,
        },
      });
    });
    const user = mount(`/stores/${storeA}/products`);
    expect(await screen.findByText('First page product')).toBeInTheDocument();
    await user.click(screen.getByTitle('Next Page'));
    expect(await screen.findByText('Second page product')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Filter products by status' }));
    await user.click(
      await screen.findByText('Draft', { selector: '.ant-select-item-option-content' }),
    );
    await waitFor(() => {
      expect(transport.calls.at(-1)).toMatchObject({
        storeId: storeA,
        variables: { offset: 0, limit: 20, status: 'DRAFT' },
      });
    });
    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'note');
    await waitFor(() => {
      expect(transport.calls.at(-1)).toMatchObject({
        storeId: storeA,
        variables: { offset: 0, limit: 20, search: 'note', status: 'DRAFT' },
      });
    });

    await switchStore(user, 'Plovdiv Store');
    expect(await screen.findByText('Plovdiv notebook')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveValue('');
    expect(
      screen.getByText('All statuses', { selector: '.ant-select-selection-item' }),
    ).toBeInTheDocument();
    expect(transport.calls.at(-1)).toMatchObject({
      storeId: storeB,
      variables: { offset: 0, limit: 20 },
    });
    await act(async () => {
      delayedSearch.resolve(
        result({
          products: {
            items: [product(storeA, 'Sofia searched result')],
            total: 1,
            offset: 0,
            limit: 20,
          },
        }),
      );
      await delayedSearch.promise;
    });
    expect(screen.queryByText('Sofia searched result')).not.toBeInTheDocument();
    expect(screen.getByText('Plovdiv notebook')).toBeInTheDocument();
  });

  it('keeps a delayed list and cached data out of the newly selected store', async () => {
    const delayed = deferredResponse();
    let delayNext = true;
    const transport = mockGraphQL((call) => {
      if (delayNext && call.operation === 'ListProducts' && call.storeId === storeA) {
        delayNext = false;
        return delayed.promise;
      }
      return defaultResult(call);
    });
    const user = mount(`/stores/${storeA}/products`);
    await waitFor(() => {
      expect(transport.calls.some((call) => call.storeId === storeA)).toBe(true);
    });
    await switchStore(user, 'Plovdiv Store');
    expect(await screen.findByText('Plovdiv notebook')).toBeInTheDocument();
    await act(async () => {
      delayed.resolve(
        defaultResult({
          operation: 'ListProducts',
          storeId: storeA,
          requestId: null,
          variables: {},
        }),
      );
      await delayed.promise;
    });
    expect(screen.queryByText('Sofia notebook')).not.toBeInTheDocument();
    expect(screen.getByText('Plovdiv notebook')).toBeInTheDocument();
    await switchStore(user, 'Sofia Store');
    expect(await screen.findByText('Sofia notebook')).toBeInTheDocument();
    expect(screen.queryByText('Plovdiv notebook')).not.toBeInTheDocument();
    await switchStore(user, 'Plovdiv Store');
    expect(await screen.findByText('Plovdiv notebook')).toBeInTheDocument();
    expect(screen.queryByText('Sofia notebook')).not.toBeInTheDocument();
  });

  it('captures a pending create, blocks duplicate submits and ignores old callbacks after switching', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'CreateProduct' ? delayed.promise : defaultResult(call),
    );
    const user = mount(`/stores/${storeA}/products/create`);
    await user.click(await screen.findByLabelText('Name'));
    await user.paste('Created in Sofia');
    await user.click(screen.getByLabelText('SKU'));
    await user.paste('NEW-1');
    await user.dblClick(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => {
      expect(transport.calls.filter((call) => call.operation === 'CreateProduct')).toHaveLength(1);
    });
    expect(screen.getByLabelText('Name')).toBeDisabled();
    await switchStore(user, 'Plovdiv Store');
    await screen.findByText('Plovdiv notebook');
    await user.click(screen.getByRole('button', { name: 'Create product' }));
    expect(screen.getByLabelText('Name')).toHaveValue('');
    await user.click(screen.getByLabelText('Name'));
    await user.paste('Unsaved Plovdiv draft');
    const requestsBefore = transport.calls.filter((call) => call.storeId === storeB).length;
    await act(async () => {
      delayed.resolve(result({ createProduct: product(storeA, 'Created in Sofia') }));
      await delayed.promise;
    });
    expect(screen.getByLabelText('Name')).toHaveValue('Unsaved Plovdiv draft');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      `/stores/${storeB}/products/create`,
    );
    expect(screen.queryByText('Product saved.')).not.toBeInTheDocument();
    expect(transport.calls.filter((call) => call.storeId === storeB)).toHaveLength(requestsBefore);
    expect(transport.calls.find((call) => call.operation === 'CreateProduct')).toMatchObject({
      storeId: storeA,
      variables: { input: { name: 'Created in Sofia', sku: 'NEW-1', status: 'DRAFT' } },
    });
  });

  it('keeps a late failed update from replacing another store form or showing an obsolete error', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'UpdateProduct' ? delayed.promise : defaultResult(call),
    );
    const user = mount(`/stores/${storeA}/products/${product().id}/edit`);
    expect(await screen.findByDisplayValue('Sofia notebook')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'UpdateProduct')).toBe(true);
    });
    await switchStore(user, 'Plovdiv Store');
    await user.click(await screen.findByText('Plovdiv notebook'));
    expect(await screen.findByDisplayValue('Plovdiv notebook')).toBeInTheDocument();
    await act(async () => {
      delayed.resolve(Response.json({ errors: [{ message: 'Old store conflict.' }] }));
      await delayed.promise;
    });
    expect(screen.getByLabelText('Name')).toHaveValue('Plovdiv notebook');
    expect(screen.queryByText('Old store conflict.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      `/stores/${storeB}/products/${product().id}/edit`,
    );
  });

  it('isolates a pending update from a new editor route within the same store', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'UpdateProduct' ? delayed.promise : defaultResult(call),
    );
    const user = mount(`/stores/${storeA}/products/${product().id}/edit`);
    await screen.findByDisplayValue('Sofia notebook');
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'UpdateProduct')).toBe(true);
    });
    await user.click(screen.getByRole('link', { name: 'Open another editor' }));
    expect(screen.getByLabelText('Name')).toBeEnabled();
    expect(screen.getByLabelText('Name')).toHaveValue('');
    await user.click(screen.getByLabelText('Name'));
    await user.paste('Independent draft');
    await act(async () => {
      delayed.resolve(result({ updateProduct: product() }));
      await delayed.promise;
    });
    expect(screen.getByLabelText('Name')).toHaveValue('Independent draft');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      `/stores/${storeA}/products/create`,
    );
    expect(screen.queryByText('Product saved.')).not.toBeInTheDocument();
  });

  it('requires delete confirmation and keeps a pending delete scoped across a switch', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'DeleteProduct' ? delayed.promise : defaultResult(call),
    );
    const user = mount(`/stores/${storeA}/products`);
    await user.click(await screen.findByRole('button', { name: 'Delete Sofia notebook' }));
    expect(transport.calls.some((call) => call.operation === 'DeleteProduct')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(transport.calls.some((call) => call.operation === 'DeleteProduct')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Delete Sofia notebook' }));
    await user.click(screen.getByRole('button', { name: 'Delete product' }));
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'DeleteProduct')).toBe(true);
    });
    await switchStore(user, 'Plovdiv Store');
    await screen.findByText('Plovdiv notebook');
    await act(async () => {
      delayed.resolve(result({ deleteProduct: { id: product().id, storeId: storeA } }));
      await delayed.promise;
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Product deleted.')).not.toBeInTheDocument();
    expect(screen.getByText('Plovdiv notebook')).toBeInTheDocument();
    expect(transport.calls.find((call) => call.operation === 'DeleteProduct')?.storeId).toBe(
      storeA,
    );
  });

  it('shows product errors with retry and a successful empty list', async () => {
    let failing = true;
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ListStores') return result({ stores });
      return failing
        ? Response.json({ errors: [{ message: 'Products temporarily unavailable.' }] })
        : result({ products: { items: [], total: 0, offset: 0, limit: 20 } });
    });
    const user = mount(`/stores/${storeA}/products`);
    expect(await screen.findByText('Products temporarily unavailable.')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No products in this store yet.')).toBeInTheDocument();
    expect(transport.calls.filter((call) => call.operation === 'ListProducts')).toHaveLength(2);
  });

  it('does not issue product requests for an unavailable route store', async () => {
    const transport = mockGraphQL(defaultResult);
    mount('/stores/not-a-store/products');
    expect(await screen.findByText('Store not found')).toBeInTheDocument();
    expect(transport.calls.map((call) => call.operation)).toEqual(['ListStores']);
  });
});
