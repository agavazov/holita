import { expect } from '@playwright/test';
import { test } from './fixture.mjs';

const store = '10000000-0000-4000-8000-000000000001';
const event = '60000000-0000-4000-8000-000000000001';

test('Aurora menus preserve list queries, apply preferences and use local examples', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (
      /^https?:/.test(request.url()) &&
      !request.url().startsWith(app.url) &&
      !request.url().startsWith(app.gatewayUrl)
    )
      external.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const path = `/stores/${store}/reference/events?q=Forum`;
  await page.goto(`${app.url}${path}`);
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('500 14px "Plus Jakarta Sans"'))).toBe(
    true,
  );
  const queryUrl = page.url();
  await page.screenshot({
    path: testInfo.outputPath('desktop-expanded.png'),
    animations: 'disabled',
  });

  const theme = page.getByRole('button', { name: 'Theme', exact: true });
  await theme.focus();
  await theme.press('Enter');
  const themes = page.getByRole('menu', { name: 'Theme presets' });
  await expect(themes).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('theme-menu.png'), animations: 'disabled' });
  await themes.getByRole('menuitemradio', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-holita-color-scheme', 'dark');
  await page.keyboard.press('Escape');
  await expect(theme).toBeFocused();
  await expect(page).toHaveURL(queryUrl);
  await page.screenshot({ path: testInfo.outputPath('desktop-dark.png'), animations: 'disabled' });
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-holita-color-scheme', 'dark');
  await theme.click();
  await themes.getByRole('menuitemradio', { name: 'Luxury', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-holita-preset', 'luxury');
  await themes.getByRole('button', { name: 'Primary color Nature', exact: true }).click();
  await expect(
    themes.getByRole('button', { name: 'Primary color Nature', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await themes.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(queryUrl);

  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('language.png'), animations: 'disabled' });
  await page.getByRole('menuitemradio', { name: /French/ }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('profile.png'), animations: 'disabled' });
  await page.getByRole('menuitemcheckbox', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-holita-color-scheme', 'dark');
  await page.getByRole('menuitemcheckbox', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-holita-color-scheme', 'light');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const notifications = page.getByRole('dialog', { name: 'Example notifications' });
  await expect(notifications).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('notifications.png'), animations: 'disabled' });
  await notifications.getByRole('button', { name: 'Mark all as read', exact: true }).click();
  await expect(notifications.getByRole('button', { name: /^Mark unread:/ })).toHaveCount(5);
  await notifications
    .getByRole('button', { name: /^Actions for/ })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Remove notification', exact: true }).click();
  await expect(notifications.getByRole('button', { name: /^Mark unread:/ })).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(queryUrl);

  await page.getByRole('textbox', { name: 'Search', exact: true }).focus();
  await page.keyboard.press('Enter');
  const search = page.getByRole('dialog', { name: 'Search workspace', exact: true });
  await expect(search.getByRole('textbox', { name: 'Search workspace' })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('search.png'), animations: 'disabled' });
  await search.getByRole('textbox', { name: 'Search workspace' }).fill('no-such-module');
  await expect(search.getByText('No matching results.')).toBeVisible();
  await search.getByRole('textbox', { name: 'Search workspace' }).fill('Venues');
  await search.getByRole('button', { name: /^Venues Workspace/ }).click();
  await expect(page).toHaveURL(`${app.url}/stores/${store}/reference/venues`);
  await expect(page.getByRole('menuitem', { name: 'Venues', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Aurora Stacked navigation supports collapse, hover, keyboard and responsive drawers', async ({
  page,
  app,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${app.url}/stores/${store}/reference/events/${event}/edit`);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Sofia Creative Forum');
  const sidenav = page.getByRole('navigation', { name: 'Workspace navigation' });
  const drawer = sidenav.locator('.MuiDrawer-paper');
  await expect(drawer).toHaveCSS('width', '300px');
  await page.getByRole('button', { name: 'Collapse navigation', exact: true }).click();
  await expect(drawer).toHaveCSS('width', '72px');
  await page.screenshot({
    path: testInfo.outputPath('desktop-collapsed.png'),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Reference navigation', exact: true }).hover();
  await expect(drawer).toHaveCSS('width', '300px');
  await page.screenshot({ path: testInfo.outputPath('desktop-hover.png'), animations: 'disabled' });
  await page.getByLabel('Title', { exact: true }).hover();
  await expect(drawer).toHaveCSS('width', '72px');
  await page.getByRole('button', { name: 'Reference navigation', exact: true }).focus();
  await expect(drawer).toHaveCSS('width', '300px');
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCSS('width', '72px');
  await expect(page.getByRole('button', { name: 'Expand navigation', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  await expect(drawer).toHaveCSS('width', '72px');
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).click();
  await expect(drawer).toHaveCSS('width', '300px');

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(drawer).toHaveCSS('width', '72px');
  await page.screenshot({ path: testInfo.outputPath('tablet.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).click();
  await expect(drawer).toHaveCSS('width', '300px');
  await sidenav.getByRole('menuitem', { name: 'Venues', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/stores/${store}/reference/venues`);
  await expect(drawer).toHaveCSS('width', '72px');
  await page.goBack();
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('combobox', { name: 'Store', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), animations: 'disabled' });
  const openNavigation = page.getByRole('button', { name: 'Open navigation', exact: true });
  await openNavigation.click();
  const mobile = page.getByRole('dialog', { name: 'Navigation', exact: true });
  await expect(mobile.getByRole('menuitem', { name: 'Events', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.screenshot({ path: testInfo.outputPath('mobile-drawer.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(mobile).toBeHidden();
  await expect(openNavigation).toBeFocused();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'Search workspace', exact: true });
  await expect(search).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(drawer).toHaveCSS('width', '300px');
});
