import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../../App.js';
import { createDataProvider } from '../../../data/data-provider.js';
import {
  deferredResponse,
  event,
  mockGraphQL,
  result,
  storeA,
  storeB,
  stores,
  type GraphQLCall,
} from '../../../test/graphql-fixture.js';

const list = `/stores/${storeA}/reference/events`;
function mount(search = '') {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: <App dataProvider={createDataProvider('http://127.0.0.1:11080/graphql')} />,
      },
    ],
    { initialEntries: [list + search] },
  );
  render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), router };
}
function respond(call: GraphQLCall) {
  if (call.operation === 'ListReferenceEventMedia') return result({ referenceEventMedia: [] });
  if (call.operation === 'ListReferenceSessions') return result({ referenceSessions: [] });
  if (call.operation === 'ListStores') return result({ stores });
  if (call.operation === 'GetReferenceEvent') return result({ referenceEvent: event() });
  if (call.operation === 'UpdateReferenceEvent') return result({ updateReferenceEvent: event() });
  if (call.operation === 'ListReferenceVenues')
    return result({ referenceVenues: { items: [], total: 0 } });
  if (call.operation === 'ListReferenceTags')
    return result({ referenceTags: { items: [], total: 0 } });
  return result({
    referenceEvents: {
      items: [
        event(call.storeId ?? storeA, call.storeId === storeB ? 'Plovdiv forum' : 'Sofia forum'),
      ],
      total: 23,
    },
  });
}
beforeEach(() => {
  localStorage.clear();
});
describe('Event list and overview', () => {
  it('restores a bookmarked query, keeps it through Show/edit/save/back and isolates column preferences by store', async () => {
    const transport = mockGraphQL(respond);
    const search =
      '?q=forum&status=DRAFT&featured=false&from=2026-11-01&to=2026-11-01&min=20&max=100&sort=budget&order=desc&page=2&size=10';
    const { user, router } = mount(search);
    await screen.findByRole('link', { name: 'Sofia forum' });
    expect(
      transport.calls.find((call) => call.operation === 'ListReferenceEvents')?.variables,
    ).toEqual({
      offset: 10,
      limit: 10,
      filter: {
        search: 'forum',
        statuses: ['DRAFT'],
        featured: false,
        startsAtFrom: '2026-10-31T22:00:00.000Z',
        startsAtBefore: '2026-11-01T22:00:00.000Z',
        capacityMin: 20,
        capacityMax: 100,
      },
      sort: { field: 'BUDGET', direction: 'DESC' },
    });
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Budget' }));
    expect(screen.getByRole('columnheader', { name: /Budget/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(screen.getByRole('link', { name: 'Sofia forum' }));
    expect(await screen.findByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit event' }));
    await screen.findByLabelText('Title');
    await user.click(screen.getByRole('button', { name: 'Save event' }));
    await screen.findByRole('tab', { name: 'Overview' });
    await user.click(screen.getByRole('button', { name: 'Back to events' }));
    await screen.findByRole('link', { name: 'Sofia forum' });
    expect(router.state.location.search).toBe(search);
    expect(screen.getByRole('columnheader', { name: /Budget/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?sort=budget&order=desc&size=10');
    });
    expect(screen.getByRole('columnheader', { name: /Budget/ })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Store' }));
    await user.click(
      await screen.findByText('Plovdiv Store', { selector: '.ant-select-item-option-content' }),
    );
    await screen.findByRole('link', { name: 'Plovdiv forum' });
    expect(router.state.location.search).toBe('');
    expect(screen.queryByRole('columnheader', { name: /Budget/ })).not.toBeInTheDocument();
    expect(
      transport.calls
        .filter((call) => call.operation === 'ListReferenceEvents' && call.storeId === storeB)
        .at(-1)?.variables,
    ).toEqual({ offset: 0, limit: 20, filter: {}, sort: { field: 'STARTS_AT', direction: 'ASC' } });
  });

  it('keeps advanced filter input while a quick filter changes the URL, and clears it on reset', async () => {
    const transport = mockGraphQL(respond);
    const { user } = mount();
    await user.click(await screen.findByRole('button', { name: 'More filters' }));
    const format = screen.getByRole('combobox', { name: 'Format' });
    await user.click(format);
    await user.click(
      await screen.findByText('In person', { selector: '.ant-select-item-option-content' }),
    );
    await user.type(screen.getByRole('searchbox', { name: 'Search events' }), 'forum{Enter}');
    await waitFor(() => {
      expect(
        transport.calls.filter((call) => call.operation === 'ListReferenceEvents').at(-1)
          ?.variables,
      ).toMatchObject({ filter: { search: 'forum' } });
    });
    expect(format).toBeInTheDocument();
    expect(
      screen.getByText('In person', { selector: '.ant-select-selection-item-content' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => {
      expect(
        transport.calls.filter((call) => call.operation === 'ListReferenceEvents').at(-1)
          ?.variables,
      ).toMatchObject({ filter: { search: 'forum', formats: ['IN_PERSON'] } });
    });
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    await user.click(screen.getByRole('button', { name: 'More filters' }));
    expect(
      screen.queryByText('In person', { selector: '.ant-select-selection-item-content' }),
    ).not.toBeInTheDocument();
  });

  it('keeps a newer search visible after an older response arrives and restores search with browser history', async () => {
    const delayed = deferredResponse();
    let oldCompleted = false;
    mockGraphQL((call) => {
      if (call.operation !== 'ListReferenceEvents') return respond(call);
      const filter = call.variables.filter;
      if (
        typeof filter === 'object' &&
        filter !== null &&
        'search' in filter &&
        filter.search === 'old'
      )
        return oldCompleted
          ? result({ referenceEvents: { items: [event(storeA, 'Old forum')], total: 1 } })
          : delayed.promise;
      return result({ referenceEvents: { items: [event(storeA, 'New forum')], total: 1 } });
    });
    const { user, router } = mount('?q=old');
    const search = await screen.findByRole('searchbox', { name: 'Search events' });
    await user.clear(search);
    await user.type(search, 'new{Enter}');
    await screen.findByRole('link', { name: 'New forum' });
    await act(async () => {
      oldCompleted = true;
      delayed.resolve(
        result({ referenceEvents: { items: [event(storeA, 'Old forum')], total: 1 } }),
      );
      await delayed.promise;
    });
    expect(screen.queryByRole('link', { name: 'Old forum' })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?q=new');
    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Search events' })).toHaveValue('old'),
    );
    await screen.findByRole('link', { name: 'Old forum' });
  });

  it('distinguishes errors, no matching filters and an empty store, and retries failed reads', async () => {
    let failed = true;
    mockGraphQL((call) =>
      call.operation !== 'ListReferenceEvents'
        ? respond(call)
        : failed
          ? Response.json({ errors: [{ message: 'Reference temporarily unavailable' }] })
          : result({ referenceEvents: { items: [], total: 0 } }),
    );
    const { user } = mount('?q=missing');
    expect(await screen.findByText(/Reference temporarily unavailable/)).toBeInTheDocument();
    expect(screen.queryByText('No events match these filters.')).not.toBeInTheDocument();
    failed = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('No events match these filters.');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('No events in this store yet.')).toBeInTheDocument();
  });

  it('does not notify or navigate the next store after an overview action finishes late', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'DeleteReferenceEvent' ? delayed.promise : respond(call),
    );
    const { user, router } = mount();
    await user.click(await screen.findByRole('link', { name: 'Sofia forum' }));
    await user.click(await screen.findByRole('button', { name: 'Move to trash' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Move to trash' }),
    );
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'DeleteReferenceEvent')).toBe(true);
    });
    await act(async () => {
      await router.navigate(`/stores/${storeB}/reference/events`);
    });
    await screen.findByRole('link', { name: 'Plovdiv forum' });
    await act(async () => {
      delayed.resolve(result({ deleteReferenceEvent: event() }));
      await delayed.promise;
    });
    expect(router.state.location.pathname).toBe(`/stores/${storeB}/reference/events`);
    expect(screen.queryByText('Event moved to trash.')).not.toBeInTheDocument();
    expect(transport.calls.find((call) => call.operation === 'DeleteReferenceEvent')?.storeId).toBe(
      storeA,
    );
  });
});
