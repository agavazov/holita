import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'react-dom';
import { Link, RouterProvider, createMemoryRouter, useLocation } from 'react-router';
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
      <Link to={`/en/stores/${storeA}/products/create`}>Open another editor</Link>
    </>
  );
}
function mount(path = '/en/') {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <App dataProvider={createDataProvider('http://127.0.0.1:11080/graphql', 'en')} />
            <Location />
          </>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  // Match the DOM provider while keeping one router module instance in the Node test runner.
  render(
    <RouterProvider
      router={router}
      flushSync={(callback) => {
        flushSync(callback);
      }}
    />,
  );
  return Object.assign(userEvent.setup(), { navigate: (path: string) => router.navigate(path) });
}

async function switchStore(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('combobox', { name: 'Store' }));
  await user.click(await screen.findByRole('option', { name }));
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
  it('blocks the UI catalog in Real without mounting a CRUD resource and returns to Products', async () => {
    const transport = mockGraphQL(defaultResult);
    const user = mount(`/en/stores/${storeA}/ui-catalog`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'UI catalog is available in Prototype only.',
    );
    expect(screen.queryByRole('menuitem', { name: 'UI catalog' })).not.toBeInTheDocument();
    expect(transport.calls.map((call) => call.operation)).toEqual(['ListStores']);
    await user.click(screen.getByRole('button', { name: 'Open products' }));
    await screen.findByText('Sofia notebook');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      `/en/stores/${storeA}/products`,
    );
  });

  it('keeps loading and failed store discovery out of CRUD and recovers on retry', async () => {
    const discovery = deferredResponse();
    let failing = true;
    const transport = mockGraphQL((call) =>
      call.operation === 'ListStores' && failing ? discovery.promise : defaultResult(call),
    );
    const user = mount();
    expect(await within(screen.getByRole('main')).findByRole('status')).toHaveTextContent(
      'Loading stores…',
    );
    await act(async () => {
      discovery.resolve(
        Response.json({ errors: [{ message: 'Stores temporarily unavailable.' }] }),
      );
      await discovery.promise;
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load stores.');
    expect(screen.getByRole('alert')).toHaveTextContent('Stores temporarily unavailable.');
    expect(transport.calls.map((call) => call.operation)).toEqual(['ListStores']);
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: 'Sofia Store' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(transport.calls.map((call) => call.operation)).toEqual(['ListStores', 'ListStores']);
    await user.click(screen.getByRole('button', { name: 'Sofia Store' }));
    await screen.findByText('Sofia notebook');
    expect(transport.calls.at(-1)?.storeId).toBe(storeA);
  });

  it('shows successful empty store discovery without enabling feature requests', async () => {
    const transport = mockGraphQL(() => result({ stores: [] }));
    mount();
    expect(
      await screen.findByText(
        'No stores available. Ask your workspace administrator to set up a store.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create product' })).not.toBeInTheDocument();
    expect(transport.calls.map((call) => call.operation)).toEqual(['ListStores']);
  });

  it('reports partial batch deletion and retries only failed records', async () => {
    const first = product();
    const second = {
      ...product(),
      id: '20000000-0000-4000-8000-000000000009',
      name: 'Second product',
      sku: 'SECOND',
    };
    let rows = [first, second];
    let rejectSecond = true;
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ListProducts')
        return result({ products: { items: rows, total: rows.length, offset: 0, limit: 20 } });
      if (call.operation === 'DeleteProduct') {
        if (call.variables.id === second.id && rejectSecond)
          return Response.json({ errors: [{ message: 'Try this record again.' }] });
        rows = rows.filter((row) => row.id !== call.variables.id);
        return result({ deleteProduct: { id: call.variables.id, storeId: storeA } });
      }
      return defaultResult(call);
    });
    const user = mount(`/en/stores/${storeA}/products`);
    await screen.findByRole('grid', { name: 'Products' });
    await screen.findByText('Second product');
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected' }));
    await user.click(screen.getByRole('button', { name: 'Delete products' }));
    expect(await screen.findByText(/Second product: Try this record again/)).toBeInTheDocument();
    expect(rows).toEqual([second]);
    rejectSecond = false;
    await user.click(screen.getByRole('button', { name: 'Delete product' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(rows).toEqual([]);
    const calls = transport.calls.filter((call) => call.operation === 'DeleteProduct');
    expect(calls.map((call) => call.variables.id)).toEqual([first.id, second.id, second.id]);
    expect(calls.every((call) => call.storeId === storeA)).toBe(true);
  });

  it('stops unsent batch deletes after navigation and leaves the new store untouched', async () => {
    const delayed = deferredResponse();
    const first = product();
    const second = {
      ...product(),
      id: '20000000-0000-4000-8000-000000000009',
      name: 'Second product',
    };
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ListProducts' && call.storeId === storeA)
        return result({ products: { items: [first, second], total: 2, offset: 0, limit: 20 } });
      if (call.operation === 'DeleteProduct') return delayed.promise;
      return defaultResult(call);
    });
    const user = mount(`/en/stores/${storeA}/products`);
    await screen.findByText('Second product');
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected' }));
    await user.click(screen.getByRole('button', { name: 'Delete products' }));
    await waitFor(() => {
      expect(transport.calls.filter((call) => call.operation === 'DeleteProduct')).toHaveLength(1);
    });
    await act(async () => {
      await user.navigate(`/en/stores/${storeB}/products`);
    });
    await screen.findByText('Plovdiv notebook');
    await act(async () => {
      delayed.resolve(result({ deleteProduct: { id: first.id, storeId: storeA } }));
      await delayed.promise;
    });
    expect(transport.calls.filter((call) => call.operation === 'DeleteProduct')).toHaveLength(1);
    expect(screen.queryByText(/products deleted/)).not.toBeInTheDocument();
    expect(screen.getByText('Plovdiv notebook')).toBeInTheDocument();
  });
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
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Second page product')).toBeInTheDocument();
    expect(transport.calls.at(-1)).toMatchObject({
      storeId: storeA,
      variables: { offset: 20, limit: 20 },
    });
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
    const user = mount(`/en/stores/${storeA}/products`);
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
          language: 'en',
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
    const user = mount(`/en/stores/${storeA}/products/create`);
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
      `/en/stores/${storeB}/products/create`,
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
    const user = mount(`/en/stores/${storeA}/products/${product().id}/edit`);
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
      `/en/stores/${storeB}/products/${product().id}/edit`,
    );
  });

  it('isolates a pending update from a new editor route within the same store', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'UpdateProduct' ? delayed.promise : defaultResult(call),
    );
    const user = mount(`/en/stores/${storeA}/products/${product().id}/edit`);
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
      `/en/stores/${storeA}/products/create`,
    );
    expect(screen.queryByText('Product saved.')).not.toBeInTheDocument();
  });

  it('requires delete confirmation and keeps a pending delete scoped across a switch', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'DeleteProduct' ? delayed.promise : defaultResult(call),
    );
    const user = mount(`/en/stores/${storeA}/products`);
    await screen.findByRole('grid', { name: 'Products' });
    await screen.findByText('Sofia notebook');
    await user.click(await screen.findByRole('button', { name: 'Actions for Sofia notebook' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(transport.calls.some((call) => call.operation === 'DeleteProduct')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(transport.calls.some((call) => call.operation === 'DeleteProduct')).toBe(false);
    await user.click(await screen.findByRole('button', { name: 'Actions for Sofia notebook' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete product' }));
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'DeleteProduct')).toBe(true);
    });
    await act(async () => {
      await user.navigate(`/en/stores/${storeB}/products`);
    });
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
    const user = mount(`/en/stores/${storeA}/products`);
    expect(await screen.findByText('Products temporarily unavailable.')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No products in this store yet.')).toBeInTheDocument();
    expect(transport.calls.filter((call) => call.operation === 'ListProducts')).toHaveLength(2);
  });

  it('does not issue product requests for an unavailable route store', async () => {
    const transport = mockGraphQL(defaultResult);
    const user = mount('/en/stores/not-a-store/products');
    expect(await screen.findByText('Store not found')).toBeInTheDocument();
    expect(transport.calls.map((call) => call.operation)).toEqual(['ListStores']);
    await user.click(screen.getByRole('button', { name: 'Plovdiv Store' }));
    await screen.findByText('Plovdiv notebook');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      `/en/stores/${storeB}/products`,
    );
    expect(transport.calls.at(-1)?.storeId).toBe(storeB);
  });
});
