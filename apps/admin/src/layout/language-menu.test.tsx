import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LocalizationProvider } from '../localization/localization-provider.js';
import LanguageMenu from './language-menu.js';

function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="Current location">{`${location.pathname}${location.search}${location.hash}`}</output>;
}

function MenuHarness({ disabled }: { disabled: boolean }) {
  return (
    <LocalizationProvider locale="en">
      <Routes>
        <Route
          path="*"
          element={
            <>
              <LanguageMenu disabled={disabled} />
              <CurrentLocation />
            </>
          }
        />
      </Routes>
    </LocalizationProvider>
  );
}

function renderMenu(disabled = false) {
  return render(
    <MemoryRouter initialEntries={['/en/stores/alpha/products?q=book#row-1']}>
      <MenuHarness disabled={disabled} />
    </MemoryRouter>,
  );
}

describe('LanguageMenu', () => {
  it('uses invariant native labels and preserves route state when switching locale', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Language' }));
    expect(screen.getByRole('menuitemradio', { name: 'Български' })).toBeVisible();
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toBeVisible();
    await user.click(screen.getByRole('menuitemradio', { name: 'Български' }));
    expect(screen.getByLabelText('Current location')).toHaveTextContent(
      '/bg/stores/alpha/products?q=book#row-1',
    );
  });

  it('prevents language navigation while an operation is pending', () => {
    renderMenu(true);
    expect(screen.getByRole('button', { name: 'Language' })).toBeDisabled();
    expect(screen.getByLabelText('Current location')).toHaveTextContent(
      '/en/stores/alpha/products?q=book#row-1',
    );
  });

  it('disables an already-open language menu when an operation starts', async () => {
    const user = userEvent.setup();
    const view = renderMenu();
    await user.click(screen.getByRole('button', { name: 'Language' }));
    expect(screen.getByRole('menuitemradio', { name: 'Български' })).toBeEnabled();

    view.rerender(
      <MemoryRouter initialEntries={['/en/stores/alpha/products?q=book#row-1']}>
        <MenuHarness disabled />
      </MemoryRouter>,
    );

    const bulgarian = screen.getByRole('menuitemradio', { name: 'Български' });
    expect(bulgarian).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(bulgarian);
    expect(screen.getByLabelText('Current location')).toHaveTextContent(
      '/en/stores/alpha/products?q=book#row-1',
    );
  });
});
