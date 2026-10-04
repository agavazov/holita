import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { render, screen } from '../test/render.js';
import { LocalizationProvider } from '../localization/localization-provider.js';
import { localeFromPathname } from '../localization/locale.js';
import { AuroraTheme } from '../theme/aurora-theme.js';
import ProfileMenu from './profile-menu.js';

function ProfileHarness() {
  const { pathname } = useLocation();
  return (
    <LocalizationProvider locale={localeFromPathname(pathname) ?? 'bg'}>
      <ProfileMenu />
    </LocalizationProvider>
  );
}

describe('ProfileMenu', () => {
  it.each([
    ['Preferences', 'Предпочитания'],
    ['Accessibility', 'Достъпност'],
    ['Account settings', 'Настройки на профила'],
    ['Help center', 'Помощен център'],
  ])('retranslates an open %s dialog when browser history changes locale', async (english, bulgarian) => {
    const router = createMemoryRouter(
      [{ path: '*', element: <AuroraTheme><ProfileHarness /></AuroraTheme> }],
      { initialEntries: ['/bg/', '/en/'], initialIndex: 1 },
    );
    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole('button', { name: 'Profile' }));
    await user.click(screen.getByRole('menuitem', { name: english }));
    expect(await screen.findByRole('dialog', { name: english })).toBeVisible();

    await router.navigate(-1);

    expect(await screen.findByRole('dialog', { name: bulgarian })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: english })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Затваряне' })).toBeVisible();
  });
});
