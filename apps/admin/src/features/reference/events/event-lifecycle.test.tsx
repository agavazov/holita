import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
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
function mount(path = list) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: <App dataProvider={createDataProvider('http://127.0.0.1:11080/graphql')} />,
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), router };
}
function respond(call: GraphQLCall) {
  if (call.operation === 'ListStores') return result({ stores });
  if (call.operation === 'ListReferenceEvents')
    return result({
      referenceEvents: {
        items: [
          event(call.storeId ?? storeA, call.storeId === storeB ? 'Plovdiv forum' : 'Sofia forum'),
        ],
        total: 25,
      },
    });
  throw new Error(`Unexpected ${call.operation}`);
}
async function selectRow(user: ReturnType<typeof userEvent.setup>) {
  const link = await screen.findByRole('link', { name: 'Sofia forum' });
  const row = link.closest('[role="row"]');
  if (!(row instanceof HTMLElement)) throw new Error('Missing event row');
  await user.click(within(row).getByRole('checkbox'));
}
describe('Event lifecycle', () => {
  it('distinguishes loading and failed history from an empty history and can retry', async () => {
    const delayed = deferredResponse();
    let fails = true;
    mockGraphQL((call) => {
      if (call.operation === 'GetReferenceEvent') return result({ referenceEvent: event() });
      if (call.operation === 'ListReferenceEventHistory')
        return fails
          ? delayed.promise
          : result({
              referenceEventHistory: { items: [], total: 0, offset: 0, limit: 20 },
            });
      return respond(call);
    });
    const { user } = mount(`${list}/${event().id}?tab=history`);
    await screen.findByText('Loading history…');
    expect(screen.queryByText('No changes recorded yet.')).not.toBeInTheDocument();
    await act(async () => {
      delayed.resolve(Response.json({ errors: [{ message: 'History service unavailable' }] }));
      await delayed.promise;
    });
    await screen.findByText('History unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('History service unavailable');
    expect(screen.queryByText('No changes recorded yet.')).not.toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('No changes recorded yet.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('clears selection with pagination, browser Back and Trash view changes', async () => {
    const transport = mockGraphQL(respond);
    const { user, router } = mount();
    await selectRow(user);
    expect(screen.getByRole('button', { name: 'Publish selected' })).toBeInTheDocument();
    await act(async () => {
      await router.navigate(list + '?page=2');
    });
    expect(screen.queryByRole('button', { name: 'Publish selected' })).not.toBeInTheDocument();
    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.queryByRole('button', { name: 'Publish selected' })).not.toBeInTheDocument();
    await selectRow(user);
    await user.click(screen.getByRole('tab', { name: 'Trash' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=trash');
    });
    expect(screen.queryByRole('button', { name: 'Restore selected' })).not.toBeInTheDocument();
    expect(
      transport.calls.filter((call) => call.operation === 'ListReferenceEvents').at(-1)?.variables,
    ).toMatchObject({ filter: { trashed: true } });
  });
  it('keeps selection after failure, retries the same explicit IDs and prevents duplicate submissions', async () => {
    let fails = true;
    const transport = mockGraphQL((call) =>
      call.operation === 'SetReferenceEventsStatus'
        ? fails
          ? Response.json({ errors: [{ message: 'Selected event is in Trash' }] })
          : result({ setReferenceEventsStatus: { ids: [event().id], count: 1 } })
        : respond(call),
    );
    const { user } = mount();
    await selectRow(user);
    await user.click(screen.getByRole('button', { name: 'Publish selected' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Selected event is in Trash')).toBeInTheDocument();
    expect(screen.getByText('1 selected on this page')).toBeInTheDocument();
    fails = false;
    await user.dblClick(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }),
    );
    await screen.findByText('Publish completed for 1 event.');
    expect(screen.queryByRole('button', { name: 'Publish selected' })).not.toBeInTheDocument();
    const calls = transport.calls.filter((call) => call.operation === 'SetReferenceEventsStatus');
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.storeId === storeA)).toBe(true);
    expect(calls[1]?.variables).toEqual({ ids: [event().id], status: 'PUBLISHED' });
  });
  it('suppresses a late bulk completion in another store', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'TrashReferenceEvents' ? delayed.promise : respond(call),
    );
    const { user, router } = mount();
    await selectRow(user);
    await user.click(screen.getByRole('button', { name: 'Trash selected' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Move to trash',
      }),
    );
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'TrashReferenceEvents')).toBe(true);
    });
    await act(async () => {
      await router.navigate(`/stores/${storeB}/reference/events`);
    });
    await screen.findByRole('link', { name: 'Plovdiv forum' });
    await act(async () => {
      delayed.resolve(result({ trashReferenceEvents: { ids: [event().id], count: 1 } }));
      await delayed.promise;
    });
    expect(screen.queryByText('Move to trash completed for 1 event.')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/stores/${storeB}/reference/events`);
    expect(transport.calls.find((call) => call.operation === 'TrashReferenceEvents')?.storeId).toBe(
      storeA,
    );
  });
  it('opens Trash read-only, escapes history excerpts, paginates and restores from Show', async () => {
    let trashed = true;
    const transport = mockGraphQL((call) => {
      if (call.operation === 'GetReferenceEvent')
        return result({
          referenceEvent: { ...event(), deletedAt: trashed ? '2026-09-27T12:00:00Z' : null },
        });
      if (call.operation === 'ListReferenceEventHistory')
        return result({
          referenceEventHistory: {
            items: [
              {
                id: 'history-1',
                eventId: event().id,
                operation: 'UPDATED',
                actor: 'Anonymous',
                subject: null,
                createdAt: '2026-09-27T12:00:00Z',
                changes: [
                  { field: 'descriptionHtml', before: null, after: '<script>alert(1)</script>' },
                ],
              },
            ],
            total: 21,
            offset: call.variables.offset,
            limit: 20,
          },
        });
      if (call.operation === 'RestoreReferenceEvents') {
        trashed = false;
        return result({ restoreReferenceEvents: { ids: [event().id], count: 1 } });
      }
      if (call.operation === 'ListReferenceSessions') return result({ referenceSessions: [] });
      if (call.operation === 'ListReferenceEventMedia') return result({ referenceEventMedia: [] });
      return respond(call);
    });
    const { user } = mount(`${list}/${event().id}?tab=history`);
    await screen.findByText('Event updated');
    expect(screen.queryByRole('button', { name: 'Edit event' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sessions' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Expand row' }));
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(
        transport.calls.filter((call) => call.operation === 'ListReferenceEventHistory').at(-1)
          ?.variables,
      ).toMatchObject({ eventId: event().id, offset: 20, limit: 20 });
    });
    expect(
      transport.calls.some((call) =>
        ['ListReferenceSessions', 'ListReferenceEventMedia'].includes(call.operation),
      ),
    ).toBe(false);
    expect(
      transport.calls.find((call) => call.operation === 'GetReferenceEvent')?.variables,
    ).toEqual({ id: event().id, includeDeleted: true });
    await user.click(screen.getByRole('button', { name: 'Restore event' }));
    await screen.findByRole('button', { name: 'Edit event' });
    expect(screen.getByRole('tab', { name: 'Sessions' })).toBeEnabled();
  });
});
