import { Refine } from '@refinedev/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'react-dom';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, it, vi } from 'vitest';
import { createDataProvider } from '../../../data/data-provider.js';
import {
  deferredResponse,
  mockGraphQL,
  venue,
  result,
  storeA,
} from '../../../test/graphql-fixture.js';
import { AuroraTheme } from '../../../theme/aurora-theme.js';
import { VenueList } from './venue-list.js';

function renderList(query: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/stores/:storeId/reference/venues',
        element: (
          <AuroraTheme>
            <Refine
              dataProvider={createDataProvider('http://127.0.0.1:11080/graphql')}
              options={{ disableTelemetry: true }}
            >
              <VenueList storeId={storeA} onDeleted={vi.fn()} />
            </Refine>
          </AuroraTheme>
        ),
      },
    ],
    { initialEntries: [`/stores/${storeA}/reference/venues${query}`] },
  );
  render(
    <RouterProvider
      router={router}
      flushSync={(callback) => {
        flushSync(callback);
      }}
    />,
  );
  return router;
}

it('commits pending text with status and prevents cleared drafts from restoring filters', async () => {
  const transport = mockGraphQL(() =>
    result({ referenceVenues: { items: [venue()], total: 1, offset: 0, limit: 10 } }),
  );
  const user = userEvent.setup();
  const query = '?sort=name&order=desc&pageSize=10';
  const router = renderList(query);
  await screen.findByRole('link', { name: 'The Glasshouse' });
  const quickSearch = screen.getByRole('searchbox', { name: 'Search venues' });
  fireEvent.change(quickSearch, { target: { value: 'hall' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Inactive' }));
  await waitFor(() => {
    expect(transport.calls.at(-1)?.variables).toMatchObject({
      search: 'hall',
      active: false,
      sort: { field: 'NAME', direction: 'DESC' },
    });
  });
  await user.click(screen.getByRole('button', { name: 'Filter venues' }));
  const panelSearch = screen.getByRole('searchbox', { name: 'Search venues' });
  expect(panelSearch).toHaveValue('hall');
  vi.useFakeTimers();
  try {
    fireEvent.change(panelSearch, { target: { value: 'bag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(quickSearch).toHaveValue('');
    expect(panelSearch).toHaveValue('');
    expect(router.state.location.search).toBe(query);
    expect(transport.calls.at(-1)?.variables).toEqual({
      offset: 0,
      limit: 10,
      sort: { field: 'NAME', direction: 'DESC' },
    });
  } finally {
    vi.useRealTimers();
  }
});

it('keeps a bookmarked page while the initial total is unknown', async () => {
  const delayed = deferredResponse();
  const transport = mockGraphQL(() => delayed.promise);
  const router = renderList('?page=2');
  await screen.findByRole('grid', { name: 'Venues' });
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  expect(router.state.location.search).toBe('?page=2');
  vi.useFakeTimers();
  try {
    await act(async () => {
      delayed.resolve(
        result({ referenceVenues: { items: [venue()], total: 25, offset: 20, limit: 20 } }),
      );
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByRole('link', { name: 'The Glasshouse' })).toBeVisible();
    expect(router.state.location.search).toBe('?page=2');
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    expect(transport.calls.map((call) => call.variables.offset)).toEqual([20]);
  } finally {
    vi.useRealTimers();
  }
});

it('discards a pending search when browser history changes another filter', async () => {
  const transport = mockGraphQL(() =>
    result({ referenceVenues: { items: [venue()], total: 1, offset: 0, limit: 20 } }),
  );
  const router = renderList('?status=ACTIVE');
  const search = await screen.findByRole('searchbox', { name: 'Search venues' });
  await act(() => router.navigate('?status=INACTIVE'));
  vi.useFakeTimers();
  try {
    fireEvent.change(search, { target: { value: 'unsent search' } });
    await act(() => router.navigate(-1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(search).toHaveValue('');
    expect(router.state.location.search).toBe('?status=ACTIVE');
    expect(transport.calls.some((call) => call.variables.search === 'unsent search')).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});
