import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App.js';
import {
  deferredResponse,
  mockGraphQL,
  product,
  result,
  storeA,
  stores,
  venue,
  type GraphQLCall,
} from '../test/graphql-fixture.js';
import type { Language } from './i18n.js';

function respond(call: GraphQLCall) {
  if (call.operation === 'ListStores') return result({ stores });
  if (call.operation === 'GetProduct') return result({ product: product() });
  if (call.operation === 'GetReferenceTag')
    return result({ referenceTag: { ...venue(), color: '#315ed0' } });
  return result({ products: { items: [product()], total: 1, offset: 0, limit: 20 } });
}

function mount(path: string, props: { dataSource?: 'mock'; onResetPrototype?: () => void } = {}) {
  const router = createMemoryRouter([{ path: '*', element: <App {...props} /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

async function changeLanguage(
  user: ReturnType<typeof userEvent.setup>,
  from: Language,
  to: Language,
) {
  await user.click(
    await screen.findByRole('button', { name: from === 'bg' ? 'Език' : 'Language' }),
  );
  await user.click(
    screen.getByRole('menuitemradio', { name: to === 'bg' ? /Български/ : /English/ }),
  );
}

describe('localized admin routes', () => {
  it('adds bg to a direct editor URL before requesting data and localizes breadcrumbs and return navigation', async () => {
    const transport = mockGraphQL(respond);
    const path = `/stores/${storeA}/products/${product().id}/edit`;
    const { router, user } = mount(`${path}?source=bookmark#details`);
    expect(await screen.findByLabelText('Име', { exact: true })).toHaveValue(product().name);
    expect(router.state.location).toMatchObject({
      pathname: `/bg${path}`,
      search: '?source=bookmark',
      hash: '#details',
    });
    expect(document.documentElement.lang).toBe('bg');
    expect(transport.calls.every((call) => call.language === 'bg')).toBe(true);
    expect(screen.getByRole('link', { name: 'Начало' })).toHaveAttribute('href', '/bg/');
    expect(screen.getByRole('link', { name: 'Продукти' })).toHaveAttribute(
      'href',
      `/bg/stores/${storeA}/products`,
    );
    await user.click(screen.getByRole('button', { name: 'Отказ' }));
    expect(router.state.location.pathname).toBe(`/bg/stores/${storeA}/products`);
  });

  it('keeps query and hash during language changes, Back and Forward and generates links in the active language', async () => {
    mockGraphQL(respond);
    const path = `/stores/${storeA}/products`;
    const { router, user } = mount(`/en${path}?status=DRAFT#rows`);
    const link = await screen.findByRole('link', { name: product().name });
    expect(link).toHaveAttribute('href', `/en${path}/${product().id}/edit`);
    await user.click(screen.getByRole('button', { name: 'Language' }));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
    await user.click(screen.getByRole('menuitemradio', { name: /Български/ }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/bg${path}`);
    });
    expect(router.state.location).toMatchObject({ search: '?status=DRAFT', hash: '#rows' });
    expect(document.documentElement.lang).toBe('bg');
    expect(await screen.findByRole('link', { name: product().name })).toHaveAttribute(
      'href',
      `/bg${path}/${product().id}/edit`,
    );
    await act(() => router.navigate(-1));
    expect(document.documentElement.lang).toBe('en');
    await act(() => router.navigate(1));
    expect(document.documentElement.lang).toBe('bg');
    await user.click(screen.getByRole('button', { name: 'Създай продукт' }));
    expect(router.state.location.pathname).toBe(`/bg${path}/create`);
  });

  it('uses the existing dirty-form confirmation before switching language and remounts only after discard', async () => {
    mockGraphQL(respond);
    const path = `/stores/${storeA}/reference/tags/${venue().id}/edit`;
    const { router, user } = mount(`/en${path}`);
    const name = await screen.findByLabelText('Name', { exact: true }, { timeout: 5000 });
    fireEvent.change(name, { target: { value: 'Unsaved title' } });
    await changeLanguage(user, 'en', 'bg');
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(router.state.location.pathname).toBe(`/en${path}`);
    expect(name).toHaveValue('Unsaved title');
    expect(document.documentElement.lang).toBe('en');
    await changeLanguage(user, 'en', 'bg');
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/bg${path}`);
    });
    expect(await screen.findByLabelText('Име', { exact: true })).toHaveValue(venue().name);
    expect(document.documentElement.lang).toBe('bg');
  });

  it('retains the submitted language and invalidates the shared resource after a late create without old navigation', async () => {
    const pending = deferredResponse();
    let saved = false;
    const transport = mockGraphQL((call) => {
      if (call.operation === 'CreateProduct') return pending.promise;
      if (call.operation === 'ListProducts')
        return result({
          products: { items: saved ? [product()] : [], total: saved ? 1 : 0, offset: 0, limit: 20 },
        });
      return respond(call);
    });
    const path = `/stores/${storeA}/products`;
    const { router, user } = mount(`/en${path}`);
    await screen.findByText('No products in this store yet.', {}, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Create product' }));
    fireEvent.change(screen.getByLabelText('Name', { exact: true }), {
      target: { value: product().name },
    });
    fireEvent.change(screen.getByLabelText('SKU', { exact: true }), {
      target: { value: product().sku },
    });
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'CreateProduct')).toBe(true);
    });
    await changeLanguage(user, 'en', 'bg');
    await user.click(screen.getByRole('button', { name: 'Отказ' }));
    await screen.findByText('Все още няма продукти в този магазин.', {}, { timeout: 5000 });
    saved = true;
    act(() => {
      pending.resolve(result({ createProduct: product() }));
    });
    await screen.findByRole('link', { name: product().name });
    expect(router.state.location.pathname).toBe(`/bg${path}`);
    expect(screen.queryByText('Продуктът е запазен.')).not.toBeInTheDocument();
    expect(transport.calls.find((call) => call.operation === 'CreateProduct')).toMatchObject({
      language: 'en',
      storeId: storeA,
    });
    expect(transport.calls.at(-1)).toMatchObject({
      operation: 'ListProducts',
      language: 'bg',
      storeId: storeA,
    });
  });

  it.each(['bg', 'en'] as const)(
    'keeps %s during Prototype Reset and removes dirty editors before discovery',
    async (language) => {
      mockGraphQL(respond);
      const reset = vi.fn();
      const { router, user } = mount(
        `/${language}/stores/${storeA}/reference/tags/${venue().id}/edit`,
        { dataSource: 'mock', onResetPrototype: reset },
      );
      fireEvent.change(
        await screen.findByLabelText(
          language === 'bg' ? 'Име' : 'Name',
          { exact: true },
          { timeout: 5000 },
        ),
        {
          target: { value: 'Disposable draft' },
        },
      );
      await user.click(
        screen.getByRole('button', {
          name: language === 'bg' ? 'Възстанови демо данните' : 'Reset demo data',
        }),
      );
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: language === 'bg' ? 'Възстанови данните' : 'Reset data',
        }),
      );
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/${language}/`);
      });
      expect(reset).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.documentElement.lang).toBe(language);
    },
  );
});
