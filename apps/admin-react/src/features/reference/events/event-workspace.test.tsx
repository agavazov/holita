import { act, render, screen, waitFor } from '@testing-library/react';
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
  venue,
  type GraphQLCall,
} from '../../../test/graphql-fixture.js';

async function mount(path = `/en/stores/${storeA}/reference/events/${event().id}/edit`) {
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
  // A case selected on its own must also wait for cold Reference module loading.
  await screen.findByLabelText('Title', {}, { timeout: 5000 });
  return { user: userEvent.setup(), router };
}
function respond(call: GraphQLCall) {
  if (call.operation === 'ListReferenceEventMedia') return result({ referenceEventMedia: [] });
  if (call.operation === 'ListReferenceSessions') return result({ referenceSessions: [] });
  if (call.operation === 'ListStores') return result({ stores });
  if (call.operation === 'GetReferenceEvent') return result({ referenceEvent: event() });
  if (call.operation === 'UpdateReferenceEvent') return result({ updateReferenceEvent: event() });
  if (call.operation === 'ListReferenceEvents')
    return result({
      referenceEvents: { items: [event(call.storeId ?? storeB, 'Plovdiv event')], total: 1 },
    });
  if (call.operation === 'ListReferenceVenues')
    return result({ referenceVenues: { items: [venue()], total: 1 } });
  return result({ referenceTags: { items: [], total: 0 } });
}
describe('Event editor lifecycle', () => {
  it('submits all sections, preserves exact decimals and dates, and omits the immutable code', async () => {
    const transport = mockGraphQL(respond);
    const { user } = await mount();
    expect(await screen.findByLabelText('Code')).toHaveAttribute('readonly');
    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByLabelText('Title'));
    await user.paste(' Edited forum ');
    await user.click(screen.getByRole('tab', { name: 'Schedule & location' }));
    expect(screen.getByLabelText('Starts at')).toHaveValue('2026-11-01T12:00');
    expect(screen.getByLabelText(/^Registration closes/)).toHaveValue('2026-11-01');
    await user.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => {
      expect(
        transport.calls.find((call) => call.operation === 'UpdateReferenceEvent')?.variables,
      ).toEqual({
        id: event().id,
        input: {
          title: 'Edited forum',
          status: 'DRAFT',
          format: 'ONLINE',
          budget: '9999999999.99',
          capacity: 80,
          featured: false,
          startsAt: event().startsAt,
          endsAt: event().endsAt,
          registrationOpensOn: '2026-10-01',
          registrationClosesOn: '2026-11-01',
          venueId: null,
          meetingUrl: 'https://example.com/forum',
          tagIds: [],
          summary: 'A short introduction.',
          descriptionHtml: null,
        },
      });
    });
  });
  it('opens the first recognized server-error section, preserves input and blocks dirty store navigation until confirmed', async () => {
    const transport = mockGraphQL((call) =>
      call.operation === 'UpdateReferenceEvent'
        ? Response.json({
            errors: [
              {
                message: 'Review the description.',
                extensions: {
                  fieldErrors: [
                    { path: 'record', message: 'Review the event.' },
                    { path: 'descriptionHtml', message: 'Use a shorter description.' },
                  ],
                },
              },
            ],
          })
        : respond(call),
    );
    const { user, router } = await mount();
    await screen.findByLabelText('Title');
    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByLabelText('Title'));
    await user.paste('Preserved input');
    await user.click(screen.getByRole('button', { name: 'Save event' }));
    expect(await screen.findByText('Use a shorter description.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Content & media' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
    await user.click(await screen.findByRole('tab', { name: 'General' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Preserved input');
    await user.click(screen.getByRole('combobox', { name: 'Store' }));
    await user.click(await screen.findByRole('option', { name: 'Plovdiv Store' }));
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(router.state.location.pathname).toContain(storeA);
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/en/stores/${storeB}/reference/events`);
    });
    expect(
      transport.calls.filter((call) => call.operation === 'UpdateReferenceEvent'),
    ).toHaveLength(1);
  });
  it('ignores a late relation search response and resolves inactive selections outside the first page', async () => {
    const delayed = deferredResponse();
    const inactiveId = '40000000-0000-4000-8000-000000000001';
    const transport = mockGraphQL((call) => {
      if (call.operation === 'GetReferenceEvent')
        return result({ referenceEvent: { ...event(), tagIds: [inactiveId] } });
      if (call.operation !== 'ListReferenceTags') return respond(call);
      if (call.variables.ids)
        return result({
          referenceTags: {
            items: [{ id: inactiveId, name: 'Old topic', active: false }],
            total: 1,
          },
        });
      if (call.variables.search === 'old') return delayed.promise;
      return result({
        referenceTags: {
          items: [
            {
              id: '40000000-0000-4000-8000-000000000002',
              name: call.variables.search === 'new' ? 'New result' : 'Current topic',
              active: true,
            },
          ],
          total: 1,
        },
      });
    });
    const { user } = await mount();
    await screen.findByLabelText('Title');
    await user.click(screen.getByRole('tab', { name: 'Schedule & location' }));
    expect(
      await screen.findByText('Old topic (inactive)', {
        selector: '.MuiChip-label',
      }),
    ).toBeInTheDocument();
    const removeInactive = screen
      .getByText('Old topic (inactive)', { selector: '.MuiChip-label' })
      .closest('.MuiChip-root')
      ?.querySelector('.MuiChip-deleteIcon');
    if (!removeInactive) throw new Error('Existing inactive tags must remain removable.');
    await user.click(removeInactive);
    expect(
      screen.queryByText('Old topic (inactive)', {
        selector: '.MuiChip-label',
      }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByRole('combobox', { name: /^Tags/ }), 'old');
    await waitFor(() => {
      expect(transport.calls.some((call) => call.variables.search === 'old')).toBe(true);
    });
    await user.clear(screen.getByRole('combobox', { name: /^Tags/ }));
    await user.type(screen.getByRole('combobox', { name: /^Tags/ }), 'new');
    expect(await screen.findByRole('option', { name: 'New result' })).toBeInTheDocument();
    await act(async () => {
      delayed.resolve(
        result({
          referenceTags: {
            items: [
              { id: '40000000-0000-4000-8000-000000000003', name: 'Obsolete result', active: true },
            ],
            total: 1,
          },
        }),
      );
      await delayed.promise;
    });
    expect(screen.queryByText('Obsolete result')).not.toBeInTheDocument();
    expect(transport.calls.find((call) => Array.isArray(call.variables.ids))?.variables).toEqual({
      offset: 0,
      limit: 100,
      ids: [inactiveId],
    });
  });
});
