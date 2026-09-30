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
  const router = createMemoryRouter(
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
  );
  render(<RouterProvider router={router} />);
  return Object.assign(userEvent.setup(), { navigate: (path: string) => router.navigate(path) });
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
      await user.click(screen.getByRole('button', { name: `Actions for ${row.name}` }));
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog');
      const confirm = within(dialog).getByRole('button', {
        name: `Delete ${entity.toLowerCase()}`,
      });
      await user.click(confirm);
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Record is still referenced.',
      );
      await waitFor(() => expect(confirm).toBeEnabled());
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
  it('reports partial batch deletion and retries only failed records', async () => {
    const first = venue();
    const second = {
      ...venue(),
      id: '20000000-0000-4000-8000-000000000009',
      name: 'Second venue',
    };
    let rows = [first, second];
    let rejectSecond = true;
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ListReferenceVenues')
        return result({
          referenceVenues: { items: rows, total: rows.length, offset: 0, limit: 20 },
        });
      if (call.operation === 'DeleteReferenceVenue') {
        if (call.variables.id === second.id && rejectSecond)
          return Response.json({
            errors: [{ message: 'Venue is still referenced by another record.' }],
          });
        rows = rows.filter((row) => row.id !== call.variables.id);
        return result({ deleteReferenceVenue: { id: call.variables.id, storeId: storeA } });
      }
      return call.operation === 'ListStores'
        ? result({ stores })
        : result({ referenceVenues: { items: [venue(storeB, 'Plovdiv hall')], total: 1 } });
    });
    const user = mount();
    await screen.findByText('Second venue');
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected' }));
    await user.click(screen.getByRole('button', { name: 'Delete venues' }));
    expect(await screen.findByText(/Second venue: Venue is still referenced/)).toBeInTheDocument();
    expect(rows).toEqual([second]);
    rejectSecond = false;
    await user.click(screen.getByRole('button', { name: 'Delete venue' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(rows).toEqual([]);
    const calls = transport.calls.filter((call) => call.operation === 'DeleteReferenceVenue');
    expect(calls.map((call) => call.variables.id)).toEqual([first.id, second.id, second.id]);
    expect(calls.every((call) => call.storeId === storeA)).toBe(true);
  });

  it('stops unsent batch deletes after navigation and leaves the new store untouched', async () => {
    const delayed = deferredResponse();
    const first = venue();
    const second = {
      ...venue(),
      id: '20000000-0000-4000-8000-000000000009',
      name: 'Second venue',
    };
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ListReferenceVenues' && call.storeId === storeA)
        return result({
          referenceVenues: { items: [first, second], total: 2, offset: 0, limit: 20 },
        });
      if (call.operation === 'DeleteReferenceVenue') return delayed.promise;
      return call.operation === 'ListStores'
        ? result({ stores })
        : result({ referenceVenues: { items: [venue(storeB, 'Plovdiv hall')], total: 1 } });
    });
    const user = mount();
    await screen.findByText('Second venue');
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected' }));
    await user.click(screen.getByRole('button', { name: 'Delete venues' }));
    await waitFor(() => {
      expect(
        transport.calls.filter((call) => call.operation === 'DeleteReferenceVenue'),
      ).toHaveLength(1);
    });
    await act(async () => {
      await user.navigate(`/stores/${storeB}/reference/venues`);
    });
    await screen.findByText('Plovdiv hall');
    await act(async () => {
      delayed.resolve(result({ deleteReferenceVenue: { id: first.id, storeId: storeA } }));
      await delayed.promise;
    });
    expect(
      transport.calls.filter((call) => call.operation === 'DeleteReferenceVenue'),
    ).toHaveLength(1);
    expect(screen.queryByText(/venues deleted/)).not.toBeInTheDocument();
    expect(screen.getByText('Plovdiv hall')).toBeInTheDocument();
  });
  it.each([
    ['Speaker', 'store'],
    ['Speaker', 'route'],
    ['Tag', 'store'],
    ['Tag', 'route'],
  ])('keeps a pending %s save out of the newly opened %s draft', async (entity, destination) => {
    const plural = `${entity.toLowerCase()}s`;
    const delayed = deferredResponse();
    const row = {
      ...venue(),
      name: 'Existing record',
      email: null,
      shortBio: null,
      color: '#315ed0',
    };
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ListStores') return result({ stores });
      if (call.operation === `CreateReference${entity}`) return delayed.promise;
      if (call.operation === `GetReference${entity}`)
        return result({ [`reference${entity}`]: row });
      return result({ [`reference${entity}s`]: { items: [row], total: 1 } });
    });
    const user = mount(true, `${plural}/create`);
    await user.type(await screen.findByLabelText('Name'), 'Pending record');
    await user.click(screen.getByRole('button', { name: `Save ${entity.toLowerCase()}` }));
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === `CreateReference${entity}`)).toBe(
        true,
      );
    });
    const next =
      destination === 'store'
        ? `/stores/${storeB}/reference/${plural}/create`
        : `/stores/${storeA}/reference/${plural}/${row.id}/edit`;
    await act(async () => {
      await user.navigate(next);
    });
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'New draft');
    await act(async () => {
      delayed.resolve(result({ [`createReference${entity}`]: { ...row, name: 'Pending record' } }));
      await delayed.promise;
    });
    expect(screen.getByLabelText('Name')).toHaveValue('New draft');
    expect(screen.queryByText(`${entity} saved.`)).not.toBeInTheDocument();
    const writes = transport.calls.filter((call) => call.operation === `CreateReference${entity}`);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.storeId).toBe(storeA);
    expect(writes[0]?.variables).toMatchObject({ input: { name: 'Pending record' } });
  });
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
    await user.click(await screen.findByRole('option', { name: 'Plovdiv Store' }));
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
