import { render, screen } from '../../test/render.js';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Link, RouterProvider, createMemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LocalizationProvider } from '../../localization/localization-provider.js';
import { useUnsavedChanges } from './use-unsaved-changes.js';

function EditorHarness() {
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const navigation = useUnsavedChanges(pending);
  return (
    <>
      <input aria-label="Draft" onChange={navigation.changed} />
      <button
        type="button"
        onClick={() => {
          setPending(true);
        }}
      >
        Start save
      </button>
      <Link to={location.pathname.replace(/^\/(?:bg|en)/, '/bg')}>Bulgarian route</Link>
      <output aria-label="Current route">{location.pathname}</output>
      {navigation.dialog}
    </>
  );
}

function Harness() {
  const location = useLocation();
  return (
    <LocalizationProvider locale={location.pathname.startsWith('/bg/') ? 'bg' : 'en'}>
      <EditorHarness />
    </LocalizationProvider>
  );
}

function mount(initialEntries = ['/en/stores/alpha/reference/events/new']) {
  const router = createMemoryRouter([{ path: '*', element: <Harness /> }], { initialEntries });
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

describe('useUnsavedChanges', () => {
  it('keeps a dirty draft mounted after a confirmed locale-only navigation', async () => {
    const { user } = mount();
    const draft = screen.getByLabelText('Draft');
    await user.type(draft, 'Чернова');
    await user.click(screen.getByRole('link', { name: 'Bulgarian route' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Discard unsaved changes?');
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      '/bg/stores/alpha/reference/events/new',
    );
    expect(screen.getByLabelText('Draft')).toHaveValue('Чернова');
  });

  it('blocks browser history from changing locale while a save is pending', async () => {
    const { router, user } = mount([
      '/bg/stores/alpha/reference/events/new',
      '/en/stores/alpha/reference/events/new',
    ]);
    await user.click(screen.getByRole('button', { name: 'Start save' }));
    await router.navigate(-1);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Please wait');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      '/en/stores/alpha/reference/events/new',
    );
    expect(screen.queryByRole('button', { name: 'Discard changes' })).not.toBeInTheDocument();
  });
});
