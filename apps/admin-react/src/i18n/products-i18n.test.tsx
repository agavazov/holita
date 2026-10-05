import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../App.js';
import { DataError } from '../data/data-provider.js';
import { ProductForm } from '../features/products/product-form.js';
import { mockGraphQL, product, result, storeA, stores } from '../test/graphql-fixture.js';
import { TestProviders } from '../test/test-providers.js';

function mount(path: string) {
  const router = createMemoryRouter([{ path: '*', element: <App /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

describe('translated Products workflows', () => {
  it('validates Bulgarian input, focuses the invalid field and preserves backend messages', async () => {
    let submitted = false;
    render(
      <TestProviders language="bg">
        <ProductForm
          pending={false}
          error={new DataError('Backend SKU conflict.', 'request-123')}
          onSubmit={() => {
            submitted = true;
          }}
          onCancel={() => undefined}
        />
      </TestProviders>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Запази продукта' }));
    expect(screen.getByText('Въведи име на продукта.')).toBeInTheDocument();
    expect(screen.getByText('Въведи SKU.')).toBeInTheDocument();
    expect(screen.getByLabelText('Име', { exact: true })).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Backend SKU conflict.');
    expect(screen.getByRole('alert')).toHaveTextContent('Идентификатор на заявката: request-123');
    expect(submitted).toBe(false);
  });

  it.each(['bg', 'en'] as const)(
    'confirms dirty Product language changes in %s and remounts only after discard',
    async (language) => {
      const transport = mockGraphQL((call) =>
        call.operation === 'ListStores' ? result({ stores }) : result({ product: product() }),
      );
      const path = `/stores/${storeA}/products/${product().id}/edit`;
      const { router, user } = mount(`/${language}${path}?source=bookmark#form`);
      const nameLabel = language === 'bg' ? 'Име' : 'Name';
      const nextLanguage = language === 'bg' ? 'en' : 'bg';
      const name = await screen.findByLabelText(nameLabel, { exact: true });
      fireEvent.change(name, { target: { value: 'Independent draft' } });
      const changeLanguage = async () => {
        await user.click(
          await screen.findByRole('button', { name: language === 'bg' ? 'Език' : 'Language' }),
        );
        await user.click(
          screen.getByRole('menuitemradio', {
            name: nextLanguage === 'bg' ? /Български/ : /English/,
          }),
        );
      };
      await changeLanguage();
      await user.click(
        screen.getByRole('button', {
          name: language === 'bg' ? 'Продължи редакцията' : 'Keep editing',
        }),
      );
      expect(router.state.location.pathname).toBe(`/${language}${path}`);
      expect(name).toHaveValue('Independent draft');
      expect(transport.calls.every((call) => call.language === language)).toBe(true);
      await changeLanguage();
      await user.click(
        screen.getByRole('button', {
          name: language === 'bg' ? 'Отхвърли промените' : 'Discard changes',
        }),
      );
      await waitFor(() => {
        expect(router.state.location).toMatchObject({
          pathname: `/${nextLanguage}${path}`,
          search: '?source=bookmark',
          hash: '#form',
        });
      });
      expect(
        await screen.findByLabelText(nextLanguage === 'bg' ? 'Име' : 'Name', { exact: true }),
      ).toHaveValue(product().name);
      expect(document.documentElement.lang).toBe(nextLanguage);
    },
  );

  it('confirms store switching and browser Back without losing a dirty Product draft', async () => {
    mockGraphQL((call) =>
      call.operation === 'ListStores'
        ? result({ stores })
        : result({ products: { items: [product()], total: 1, offset: 0, limit: 20 } }),
    );
    const path = `/bg/stores/${storeA}/products`;
    const { router, user } = mount(path);
    await user.click(await screen.findByRole('button', { name: 'Създай продукт' }));
    const name = screen.getByLabelText('Име', { exact: true });
    fireEvent.change(name, { target: { value: 'Незаписан продукт' } });
    await user.click(screen.getByRole('combobox', { name: 'Магазин' }));
    await user.click(screen.getByRole('option', { name: 'Plovdiv Store' }));
    await user.click(screen.getByRole('button', { name: 'Продължи редакцията' }));
    expect(name).toHaveValue('Незаписан продукт');
    expect(router.state.location.pathname).toBe(`${path}/create`);
    await act(() => router.navigate(-1));
    await user.click(screen.getByRole('button', { name: 'Отхвърли промените' }));
    expect(router.state.location.pathname).toBe(path);
    expect(await screen.findByRole('link', { name: product().name })).toBeInTheDocument();
  });

  it('creates and deletes a Product with Bulgarian notices and unchanged API values', async () => {
    let rows = [product()];
    const created = {
      ...product(),
      id: '20000000-0000-4000-8000-000000000002',
      name: 'Нов продукт',
      sku: 'NEW-BG',
    };
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ListStores') return result({ stores });
      if (call.operation === 'CreateProduct') {
        rows = [...rows, created];
        return result({ createProduct: created });
      }
      if (call.operation === 'DeleteProduct') {
        rows = rows.filter((row) => row.id !== call.variables.id);
        return result({ deleteProduct: { id: call.variables.id, storeId: storeA } });
      }
      return result({ products: { items: rows, total: rows.length, offset: 0, limit: 20 } });
    });
    const { user } = mount(`/bg/stores/${storeA}/products`);
    await user.click(await screen.findByRole('button', { name: 'Създай продукт' }));
    fireEvent.change(screen.getByLabelText('Име', { exact: true }), {
      target: { value: created.name },
    });
    fireEvent.change(screen.getByLabelText('SKU', { exact: true }), {
      target: { value: created.sku },
    });
    await user.click(screen.getByRole('button', { name: 'Запази продукта' }));
    await screen.findByRole('link', { name: created.name }, { timeout: 5000 });
    expect(screen.getByText('Продуктът е запазен.')).toBeInTheDocument();
    expect(transport.calls.find((call) => call.operation === 'CreateProduct')).toMatchObject({
      language: 'bg',
      storeId: storeA,
      variables: { input: { name: created.name, sku: created.sku, status: 'DRAFT' } },
    });
    await user.click(screen.getByRole('button', { name: `Действия за ${created.name}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Изтрий' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Да се изтрие ли продуктът?');
    await user.click(screen.getByRole('button', { name: 'Изтрий продукта' }));
    await screen.findByText('Продуктът е изтрит.');
    expect(screen.queryByRole('link', { name: created.name })).not.toBeInTheDocument();
  });
});
