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
  session,
  storeA,
  storeB,
  stores,
  type GraphQLCall,
} from '../../../test/graphql-fixture.js';

const root = `/en/stores/${storeA}/reference/events/${event().id}`;
function mount(path = `${root}?tab=sessions`) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: <App dataProvider={createDataProvider('http://127.0.0.1:11080/graphql', 'en')} />,
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), router };
}
function respond(call: GraphQLCall) {
  if (call.operation === 'ListReferenceEventMedia') return result({ referenceEventMedia: [] });
  if (call.operation === 'ListStores') return result({ stores });
  if (call.operation === 'GetReferenceEvent')
    return result({
      referenceEvent: event(
        call.storeId ?? storeA,
        call.storeId === storeB ? 'Plovdiv event' : 'Sofia forum',
      ),
    });
  if (call.operation === 'ListReferenceSessions')
    return result({ referenceSessions: [session(), session('Workshop', 1)] });
  if (call.operation === 'GetReferenceSession') return result({ referenceSession: session() });
  if (call.operation === 'ListReferenceSpeakers')
    return result({ referenceSpeakers: { items: [], total: 0 } });
  if (call.operation === 'ListReferenceEvents')
    return result({ referenceEvents: { items: [event(storeB, 'Plovdiv event')], total: 1 } });
  throw new Error(`Unexpected ${call.operation}`);
}
function titles() {
  return within(screen.getByRole('list', { name: 'Event sessions' }))
    .getAllByRole('listitem')
    .map((item) => item.getAttribute('aria-label'));
}
beforeEach(() => {
  localStorage.clear();
});

describe('Session editor and program lifecycle', () => {
  it.each([
    { startsAt: '2026-10-25T00:30:00.000Z', endsAt: '2026-10-25T01:30:00.000Z' },
    { startsAt: '2026-10-25T00:30:10.123Z', endsAt: '2026-10-25T00:30:40.456Z' },
  ])(
    'preserves exact instants when both Sofia inputs display the same minute: $startsAt',
    async (times) => {
      const transport = mockGraphQL((call) => {
        if (call.operation === 'GetReferenceEvent')
          return result({
            referenceEvent: {
              ...event(),
              startsAt: '2026-10-24T21:00:00.000Z',
              endsAt: '2026-10-25T08:00:00.000Z',
            },
          });
        if (call.operation === 'GetReferenceSession')
          return result({ referenceSession: { ...session(), ...times } });
        if (call.operation === 'UpdateReferenceSession')
          return result({ updateReferenceSession: { ...session(), ...times } });
        return respond(call);
      });
      const { user } = mount(`${root}/sessions/${session().id}/edit`);
      expect(await screen.findByLabelText('Starts at')).toHaveValue('2026-10-25T03:30');
      expect(screen.getByLabelText('Ends at')).toHaveValue('2026-10-25T03:30');
      await user.clear(screen.getByLabelText('Room'));
      await user.click(screen.getByRole('button', { name: 'Save session' }));
      await waitFor(() => {
        expect(
          transport.calls.find((call) => call.operation === 'UpdateReferenceSession'),
        ).toMatchObject({
          storeId: storeA,
          variables: { eventId: event().id, input: { ...times, room: null } },
        });
      });
      await screen.findByRole('button', { name: 'Add session' });
    },
  );
  it('keeps failed order drafts, confirms navigation and reloads server order on cancel before saving explicitly', async () => {
    let fail = true;
    let rows = [session(), session('Workshop', 1)];
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ListReferenceSessions') return result({ referenceSessions: rows });
      if (call.operation === 'ReorderReferenceSessions') {
        if (fail)
          return Response.json({
            errors: [
              {
                message:
                  'The session list changed. Cancel the draft to reload it, then arrange it again.',
              },
            ],
          });
        rows = [session('Workshop', 1), session()];
        return result({ reorderReferenceSessions: rows });
      }
      return respond(call);
    });
    const { user } = mount();
    await screen.findByRole('button', { name: 'Move Opening down' }, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Move Opening down' }));
    expect(titles()).toEqual(['Workshop', 'Opening']);
    expect(transport.calls.some((call) => call.operation === 'ReorderReferenceSessions')).toBe(
      false,
    );
    expect(screen.getByRole('button', { name: 'Add session' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    await screen.findByText('Discard unsaved changes?');
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await user.click(await screen.findByRole('button', { name: 'Save order' }));
    await screen.findByText(
      'The session list changed. Cancel the draft to reload it, then arrange it again.',
    );
    expect(titles()).toEqual(['Workshop', 'Opening']);
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    await waitFor(() => {
      expect(titles()).toEqual(['Opening', 'Workshop']);
    });
    expect(screen.getByRole('button', { name: 'Save order' })).toBeDisabled();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Move Workshop up' }));
    await user.click(screen.getByRole('button', { name: 'Save order' }));
    await screen.findByText('Session order saved.');
    expect(screen.getByRole('button', { name: 'Save order' })).toBeDisabled();
    expect(transport.calls.filter((call) => call.operation === 'ReorderReferenceSessions')).toEqual(
      [
        expect.objectContaining({
          storeId: storeA,
          variables: { eventId: event().id, ids: [session('Workshop', 1).id, session().id] },
        }),
        expect.objectContaining({
          storeId: storeA,
          variables: { eventId: event().id, ids: [session('Workshop', 1).id, session().id] },
        }),
      ],
    );
  });
  it('preserves the edit form and selected inactive speakers after server validation errors', async () => {
    const speaker = { id: '50000000-0000-4000-8000-000000000001', name: 'Alex', active: false };
    const transport = mockGraphQL((call) => {
      if (call.operation === 'GetReferenceSession')
        return result({
          referenceSession: { ...session(), speakers: [speaker], speakerIds: [speaker.id] },
        });
      if (call.operation === 'ListReferenceSpeakers')
        return result({
          referenceSpeakers: {
            items: call.variables.ids ? [speaker] : [],
            total: call.variables.ids ? 1 : 0,
          },
        });
      if (call.operation === 'UpdateReferenceSession')
        return Response.json({
          errors: [
            {
              message: 'Review the room.',
              extensions: { fieldErrors: [{ path: 'room', message: 'Use a shorter room name.' }] },
            },
          ],
        });
      return respond(call);
    });
    const { user } = mount(`${root}/sessions/${session().id}/edit`);
    expect(await screen.findByLabelText('Starts at')).toHaveValue('2026-11-01T12:00');
    await screen.findByText('Alex (inactive)', { selector: '.MuiChip-label' });
    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByLabelText('Title'));
    await user.paste('Edited opening');
    await user.click(screen.getByRole('button', { name: 'Save session' }));
    await screen.findByText('Use a shorter room name.');
    expect(screen.getByLabelText('Title')).toHaveValue('Edited opening');
    expect(
      transport.calls.find((call) => call.operation === 'UpdateReferenceSession'),
    ).toMatchObject({
      storeId: storeA,
      variables: {
        eventId: event().id,
        id: session().id,
        input: {
          title: 'Edited opening',
          speakerIds: [speaker.id],
          startsAt: session().startsAt,
          endsAt: session().endsAt,
        },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByText('Discard unsaved changes?');
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await screen.findByRole('button', { name: 'Add session' });
  });
  it('cannot redirect or notify a new store when an old session save completes', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'UpdateReferenceSession' ? delayed.promise : respond(call),
    );
    const { user, router } = mount(`${root}/sessions/${session().id}/edit`);
    await screen.findByLabelText('Title');
    await user.click(screen.getByRole('button', { name: 'Save session' }));
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'UpdateReferenceSession')).toBe(
        true,
      );
    });
    await act(async () => {
      await router.navigate(`/en/stores/${storeB}/reference/events`);
    });
    await screen.findByRole('link', { name: 'Plovdiv event' });
    await act(async () => {
      delayed.resolve(result({ updateReferenceSession: session() }));
      await delayed.promise;
    });
    expect(router.state.location.pathname).toBe(`/en/stores/${storeB}/reference/events`);
    expect(screen.queryByText('Session saved.')).not.toBeInTheDocument();
    expect(
      transport.calls.find((call) => call.operation === 'UpdateReferenceSession')?.storeId,
    ).toBe(storeA);
  });
  it('isolates a pending order from a newly opened parent and derives unique overview speakers', async () => {
    const delayed = deferredResponse();
    const nextId = '60000000-0000-4000-8000-000000000002';
    const speaker = { id: '50000000-0000-4000-8000-000000000001', name: 'Alex', active: true };
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ReorderReferenceSessions') return delayed.promise;
      if (call.operation === 'GetReferenceEvent' && call.variables.id === nextId)
        return result({ referenceEvent: { ...event(), id: nextId, title: 'Another forum' } });
      if (call.operation === 'ListReferenceSessions' && call.variables.eventId === nextId)
        return result({
          referenceSessions: [
            { ...session(), eventId: nextId, speakers: [speaker] },
            { ...session('Workshop', 1), eventId: nextId, speakers: [speaker] },
          ],
        });
      return respond(call);
    });
    const { user, router } = mount();
    await screen.findByRole('button', { name: 'Move Opening down' }, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Move Opening down' }));
    await user.click(screen.getByRole('button', { name: 'Save order' }));
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'ReorderReferenceSessions')).toBe(
        true,
      );
    });
    await act(async () => {
      await router.navigate(`/en/stores/${storeA}/reference/events/${nextId}`);
    });
    await screen.findByText('Alex');
    const count = transport.calls.filter(
      (call) => call.operation === 'ListReferenceSessions' && call.variables.eventId === nextId,
    ).length;
    await act(async () => {
      delayed.resolve(result({ reorderReferenceSessions: [session('Workshop', 1), session()] }));
      await delayed.promise;
    });
    expect(screen.getAllByText('Alex')).toHaveLength(1);
    expect(router.state.location.pathname).toContain(nextId);
    expect(screen.queryByText('Session order saved.')).not.toBeInTheDocument();
    expect(
      transport.calls.filter(
        (call) => call.operation === 'ListReferenceSessions' && call.variables.eventId === nextId,
      ),
    ).toHaveLength(count);
  });
});
