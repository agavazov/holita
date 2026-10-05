import { Refine } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createDataProvider } from '../data/data-provider.js';
import {
  event,
  mockGraphQL,
  product,
  result,
  session,
  storeA,
  stores,
  venue,
  type GraphQLCall,
} from '../test/graphql-fixture.js';
import { TestProviders } from '../test/test-providers.js';
import { StoreWorkspace } from './stores/store-workspace.js';

const eventPath = `reference/events/${event().id}`;
function respond(call: GraphQLCall) {
  switch (call.operation) {
    case 'ListStores':
      return result({ stores });
    case 'GetProduct':
      return result({ product: product() });
    case 'GetReferenceVenue':
      return result({ referenceVenue: venue() });
    case 'GetReferenceSpeaker':
      return result({ referenceSpeaker: { ...venue(), email: null, shortBio: null } });
    case 'GetReferenceTag':
      return result({ referenceTag: { ...venue(), color: '#315ed0' } });
    case 'GetReferenceEvent':
      return result({ referenceEvent: event() });
    case 'GetReferenceSession':
      return result({ referenceSession: session() });
    case 'ListReferenceEventMedia':
      return result({ referenceEventMedia: [] });
    case 'ListReferenceSessions':
      return result({ referenceSessions: [session(), session('Workshop', 1)] });
    case 'ListReferenceSpeakers':
      return result({ referenceSpeakers: { items: [], total: 0 } });
    case 'ListReferenceVenues':
      return result({ referenceVenues: { items: [], total: 0 } });
    case 'ListReferenceTags':
      return result({ referenceTags: { items: [], total: 0 } });
    default:
      throw new Error(`Unexpected ${call.operation}`);
  }
}
function mount(path: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [
      {
        element: (
          <TestProviders>
            <Refine
              routerProvider={routerProvider}
              dataProvider={createDataProvider('http://127.0.0.1:11080/graphql', 'en')}
              options={{ disableTelemetry: true, reactQuery: { clientConfig: client } }}
            >
              <Outlet />
            </Refine>
          </TestProviders>
        ),
        children: ['products', 'reference'].map((section) => ({
          path: `/:language/stores/:storeId/${section}/*`,
          element: <StoreWorkspace />,
        })),
      },
    ],
    { initialEntries: [`/en/stores/${storeA}/${path}`] },
  );
  const view = render(<RouterProvider router={router} />);
  return {
    isFetching: () => client.isFetching(),
    refresh: () =>
      act(async () => {
        await client.refetchQueries({ type: 'active' });
      }),
    close: () => {
      view.unmount();
      client.clear();
    },
  };
}

describe('background refresh', () => {
  it.each([
    ['Product', `products/${product().id}/edit`, 'Name', 'GetProduct', product().name],
    ['Event', `${eventPath}/edit`, 'Title', 'GetReferenceEvent', event().title],
    ['Session parent', `${eventPath}/sessions/create`, 'Title', 'GetReferenceEvent', ''],
  ])(
    'keeps an initial %s read failure out of the form until retry succeeds',
    async (_name, path, label, operation, value) => {
      let failing = true;
      mockGraphQL((call) =>
        failing && call.operation === operation
          ? Response.json({ errors: [{ message: 'Initial read unavailable.' }] })
          : respond(call),
      );
      const view = mount(path);
      try {
        const error = await screen.findByRole('alert', {}, { timeout: 10_000 });
        expect(error).toHaveTextContent('Initial read unavailable.');
        expect(screen.queryByRole('textbox', { name: label })).not.toBeInTheDocument();
        failing = false;
        fireEvent.click(within(error).getByRole('button', { name: 'Retry' }));
        expect(
          await screen.findByRole('textbox', { name: label }, { timeout: 10_000 }),
        ).toHaveValue(value);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      } finally {
        view.close();
      }
    },
  );

  it.each([
    ['Product', `products/${product().id}/edit`, 'Name', 'GetProduct'],
    ['Venue', `reference/venues/${venue().id}/edit`, 'Name', 'GetReferenceVenue'],
    ['Speaker', `reference/speakers/${venue().id}/edit`, 'Name', 'GetReferenceSpeaker'],
    ['Tag', `reference/tags/${venue().id}/edit`, 'Name', 'GetReferenceTag'],
    ['Event', `${eventPath}/edit`, 'Title', 'GetReferenceEvent'],
    ['Session', `${eventPath}/sessions/${session().id}/edit`, 'Title', 'GetReferenceSession'],
    ['Session parent', `${eventPath}/sessions/create`, 'Title', 'GetReferenceEvent'],
    ['Product store', 'products/create', 'Name', 'ListStores'],
    ['Event store', `${eventPath}/edit`, 'Title', 'ListStores'],
  ])(
    'preserves the %s draft through failure, retry and recovery',
    async (_name, path, label, operation) => {
      let failing = false;
      mockGraphQL((call) =>
        failing && call.operation === operation
          ? Response.json({ errors: [{ message: 'Refresh temporarily unavailable.' }] })
          : respond(call),
      );
      const view = mount(path);
      try {
        const input = await screen.findByRole('textbox', { name: label }, { timeout: 10_000 });
        fireEvent.change(input, { target: { value: 'My unsaved revision' } });
        failing = true;
        await view.refresh();
        const warning = await screen.findByRole('alert');
        expect(warning).toHaveTextContent('Refresh temporarily unavailable.');
        expect(screen.getByRole('textbox', { name: label })).toBe(input);
        expect(input).toHaveValue('My unsaved revision');
        // A second failure must preserve the same mounted form too.
        fireEvent.click(within(warning).getByRole('button', { name: 'Retry' }));
        await waitFor(() => {
          expect(view.isFetching()).toBe(0);
        });
        await waitFor(() =>
          expect(within(warning).getByRole('button', { name: 'Retry' })).toBeEnabled(),
        );
        expect(input).toHaveValue('My unsaved revision');
        failing = false;
        fireEvent.click(within(warning).getByRole('button', { name: 'Retry' }));
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        expect(screen.getByRole('textbox', { name: label })).toBe(input);
        expect(input).toHaveValue('My unsaved revision');
      } finally {
        view.close();
      }
    },
  );

  it('preserves an unsaved session order when the parent overview refresh fails', async () => {
    let failing = false;
    mockGraphQL((call) =>
      failing && call.operation === 'GetReferenceEvent'
        ? Response.json({ errors: [{ message: 'Refresh temporarily unavailable.' }] })
        : respond(call),
    );
    const view = mount(`${eventPath}?tab=sessions`);
    try {
      fireEvent.click(
        await screen.findByRole('button', { name: 'Move Workshop up' }, { timeout: 10_000 }),
      );
      const titles = () =>
        within(screen.getByRole('list', { name: 'Event sessions' }))
          .getAllByRole('listitem')
          .map((item) => item.getAttribute('aria-label'));
      expect(titles()).toEqual(['Workshop', 'Opening']);
      failing = true;
      await view.refresh();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Refresh temporarily unavailable.',
      );
      expect(titles()).toEqual(['Workshop', 'Opening']);
      failing = false;
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      expect(titles()).toEqual(['Workshop', 'Opening']);
      expect(screen.getByRole('button', { name: 'Save order' })).toBeEnabled();
    } finally {
      view.close();
    }
  });
});
