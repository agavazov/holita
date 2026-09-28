import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../../App.js';
import { createDataProvider } from '../../data/data-provider.js';
import {
  deferredResponse,
  mockGraphQL,
  result,
  storeA,
  storeB,
  stores,
  venue,
} from '../../test/graphql-fixture.js';

function mount(referenceEnabled = true, resource = 'venues') {
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: '*',
            element: (
              <>
                <App
                  referenceEnabled={referenceEnabled}
                  dataProvider={createDataProvider('http://127.0.0.1:11080/graphql')}
                />
              </>
            ),
          },
        ],
        { initialEntries: [`/stores/${storeA}/reference/${resource}`] },
      )}
    />,
  );
  return userEvent.setup();
}

describe('Reference workspace', () => {
  it.each(['Venue', 'Speaker', 'Tag'])(
    'retries a failed %s deletion and refreshes its scoped list',
    async (entity) => {
      const plural = `${entity.toLowerCase()}s`;
      const row = {
        ...venue(),
        name: 'Supporting record',
        email: null,
        shortBio: null,
        color: '#1677ff',
      };
      let removed = false;
      let attempts = 0;
      const transport = mockGraphQL((call) => {
        if (call.operation === 'ListStores') return result({ stores });
        if (call.operation === `DeleteReference${entity}`) {
          if (++attempts === 1)
            return Response.json({ errors: [{ message: 'Record is still referenced.' }] });
          removed = true;
          return result({ [`deleteReference${entity}`]: row });
        }
        return result({
          [`reference${entity}s`]: { items: removed ? [] : [row], total: removed ? 0 : 1 },
        });
      });
      const user = mount(true, plural);
      expect(
        await screen.findByRole('link', { name: row.name }, { timeout: 5000 }),
      ).toHaveAttribute('href', `/stores/${storeA}/reference/${plural}/${row.id}/edit`);
      await user.click(screen.getByRole('button', { name: `Delete ${row.name}` }));
      const dialog = await screen.findByRole('dialog');
      const confirm = within(dialog).getByRole('button', {
        name: `Delete ${entity.toLowerCase()}`,
      });
      await user.click(confirm);
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Record is still referenced.',
      );
      await waitFor(() => expect(confirm).not.toHaveClass('ant-btn-loading'));
      await user.click(confirm);
      expect(await screen.findByText(`No ${plural} in this store yet.`)).toBeVisible();
      expect(
        transport.calls.filter((call) => call.operation === `DeleteReference${entity}`),
      ).toEqual([
        expect.objectContaining({ storeId: storeA, variables: { id: row.id } }),
        expect.objectContaining({ storeId: storeA, variables: { id: row.id } }),
      ]);
    },
  );
  it('hides navigation and rejects a direct route when disabled without requesting venues', async () => {
    const transport = mockGraphQL(() => result({ stores }));
    mount(false);
    expect(await screen.findByText('Reference is disabled.')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Venues' })).not.toBeInTheDocument();
    expect(transport.calls.map((call) => call.operation)).toEqual(['ListStores']);
  });
  it('keeps a late Venue list out of the newly selected store', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'ListStores'
        ? result({ stores })
        : call.storeId === storeA
          ? delayed.promise
          : result({
              referenceVenues: {
                items: [venue(storeB, 'Plovdiv hall')],
                total: 1,
                offset: 0,
                limit: 20,
              },
            }),
    );
    const user = mount();
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'ListReferenceVenues')).toBe(true);
    });
    await user.click(screen.getByRole('combobox', { name: 'Store' }));
    await user.click(
      await screen.findByRole('option', { name: 'Plovdiv Store' }),
    );
    expect(await screen.findByRole('link', { name: 'Plovdiv hall' })).toBeInTheDocument();
    await act(async () => {
      delayed.resolve(
        result({ referenceVenues: { items: [venue()], total: 1, offset: 0, limit: 20 } }),
      );
      await delayed.promise;
    });
    expect(screen.queryByText('The Glasshouse')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plovdiv hall' })).toBeInTheDocument();
  });
});
