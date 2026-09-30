import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../../../App.js';
import { createDataProvider } from '../../../data/data-provider.js';
import type { ReferenceEventMediaDetailsFragment } from '../../../generated/graphql/operations.js';
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

function image(position: number): ReferenceEventMediaDetailsFragment {
  return {
    id: `80000000-0000-4000-8000-${String(position + 1).padStart(12, '0')}`,
    eventId: event().id,
    originalName: `${String(position)}.png`,
    contentType: 'image/png',
    byteSize: 100,
    altText: null,
    position,
    isCover: position === 0,
    readUrl: `https://example.com/${String(position)}.png`,
    readUrlExpiresAt: '2026-11-01T10:00:00Z',
    createdAt: event().createdAt,
  };
}
function respond(call: GraphQLCall) {
  if (call.operation === 'ListStores') return result({ stores });
  if (call.operation === 'GetReferenceEvent') return result({ referenceEvent: event() });
  if (call.operation === 'ListReferenceEventMedia')
    return result({ referenceEventMedia: [image(0), image(1)] });
  if (call.operation === 'ListReferenceTags')
    return result({ referenceTags: { items: [], total: 0 } });
  if (call.operation === 'ListReferenceVenues')
    return result({ referenceVenues: { items: [], total: 0 } });
  if (call.operation === 'ListReferenceEvents')
    return result({ referenceEvents: { items: [event(storeB, 'Plovdiv event')], total: 1 } });
  throw new Error(`Unexpected operation ${call.operation}`);
}
function mount() {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: <App dataProvider={createDataProvider('http://127.0.0.1:11080/graphql')} />,
      },
    ],
    { initialEntries: [`/stores/${storeA}/reference/events/${event().id}/edit`] },
  );
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}
describe('Independent gallery editing', () => {
  it('shows a failed gallery load and recovers through Refresh previews without claiming it is empty', async () => {
    let fails = true;
    mockGraphQL((call) =>
      call.operation === 'ListReferenceEventMedia' && fails
        ? Response.json({ errors: [{ message: 'Media service unavailable' }] })
        : respond(call),
    );
    const { user } = mount();
    await screen.findByLabelText('Title');
    await user.click(screen.getByRole('tab', { name: 'Content & media' }));
    const gallery = within(screen.getByRole('region', { name: 'Event gallery' }));
    await gallery.findByText('Gallery unavailable. Use Refresh previews to try again.');
    expect(gallery.getByRole('alert')).toHaveTextContent('Media service unavailable');
    expect(gallery.queryByText('No images yet')).not.toBeInTheDocument();
    fails = false;
    await user.click(gallery.getByRole('button', { name: 'Refresh previews' }));
    await gallery.findByLabelText('Image 0.png');
    expect(gallery.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('keeps a failed order draft, confirms navigation, cancels to server order and saves alt text without submitting the event', async () => {
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ReorderReferenceEventMedia')
        return Response.json({ errors: [{ message: 'Gallery changed. Reload its order.' }] });
      if (call.operation === 'UpdateReferenceEventMedia')
        return result({ updateReferenceEventMedia: { ...image(1), altText: 'Hall' } });
      return respond(call);
    });
    const { user } = mount();
    await screen.findByLabelText('Title');
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Unsaved title');
    await user.click(screen.getByRole('tab', { name: 'Content & media' }));
    const gallery = within(screen.getByRole('region', { name: 'Event gallery' }));
    await user.click(await gallery.findByRole('button', { name: 'Move 0.png later' }));
    expect(screen.getByRole('button', { name: 'Save event' })).toBeDisabled();
    await user.click(gallery.getByRole('button', { name: 'Save order' }));
    await gallery.findByText('Gallery changed. Reload its order.');
    expect(gallery.getAllByLabelText(/^Image [01]\.png$/)[0]).toHaveAttribute(
      'aria-label',
      'Image 1.png',
    );
    await user.click(
      within(screen.getByRole('form', { name: 'Event form' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
    await user.click(await gallery.findByRole('button', { name: 'Cancel order' }));
    await waitFor(() =>
      expect(gallery.getAllByLabelText(/^Image [01]\.png$/)[0]).toHaveAttribute(
        'aria-label',
        'Image 0.png',
      ),
    );
    await user.click(
      within(gallery.getByLabelText('Image 1.png')).getByRole('button', { name: 'Alt text' }),
    );
    await user.type(screen.getByRole('textbox', { name: 'Alt text' }), 'Hall');
    await user.click(screen.getByRole('button', { name: 'Save alt text' }));
    await screen.findByText('Alt text saved.');
    await user.click(await screen.findByRole('tab', { name: 'General' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Unsaved title');
    expect(
      transport.calls.filter((call) => call.operation === 'UpdateReferenceEvent'),
    ).toHaveLength(0);
    expect(
      transport.calls.find((call) => call.operation === 'UpdateReferenceEventMedia'),
    ).toMatchObject({
      storeId: storeA,
      variables: { eventId: event().id, id: image(1).id, input: { altText: 'Hall' } },
    });
    await user.click(
      within(screen.getByRole('form', { name: 'Event form' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
  });
  it('keeps a late cover mutation scoped to its original store without stale feedback', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.operation === 'SetReferenceEventCover' ? delayed.promise : respond(call),
    );
    const { user, router } = mount();
    await screen.findByLabelText('Title');
    await user.click(screen.getByRole('tab', { name: 'Content & media' }));
    await user.click(
      within(await screen.findByLabelText('Image 1.png')).getByRole('button', {
        name: 'Set cover',
      }),
    );
    await waitFor(() => {
      expect(transport.calls.some((call) => call.operation === 'SetReferenceEventCover')).toBe(
        true,
      );
    });
    await user.click(screen.getByRole('combobox', { name: 'Store' }));
    await user.click(await screen.findByRole('option', { name: 'Plovdiv Store' }));
    await screen.findByRole('link', { name: 'Plovdiv event' });
    await act(async () => {
      delayed.resolve(result({ setReferenceEventCover: [{ ...image(1), isCover: true }] }));
      await delayed.promise;
    });
    expect(router.state.location.pathname).toBe(`/stores/${storeB}/reference/events`);
    expect(screen.queryByText('Cover saved.')).not.toBeInTheDocument();
    expect(
      transport.calls.find((call) => call.operation === 'SetReferenceEventCover'),
    ).toMatchObject({ storeId: storeA, variables: { eventId: event().id, id: image(1).id } });
    expect(
      transport.calls
        .filter((call) => call.operation === 'ListReferenceEventMedia')
        .every((call) => call.storeId === storeA),
    ).toBe(true);
  });
});
