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
  const path = `/en/stores/${store}/reference/events?q=Forum`;
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
  await expect(themes).toHaveCount(0);
  await expect(page).toHaveURL(queryUrl);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-holita-color-scheme', 'dark');
  await page.screenshot({ path: testInfo.outputPath('desktop-dark.png'), animations: 'disabled' });
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
  await page.getByRole('menuitemradio', { name: /Български/ }).click();
  await expect(page).toHaveURL(queryUrl.replace('/en/', '/bg/'));
  await page.getByRole('button', { name: 'Език', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /English/ }).click();
  await expect(page).toHaveURL(queryUrl);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('menu', { name: 'Profile', exact: true }).locator('..')).toHaveCSS(
    'transform',
    'none',
  );
  await expect(page.getByRole('menuitem', { name: 'Preferences', exact: true })).toHaveCSS(
    'color',
    'rgb(27, 33, 36)',
  );
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
  await expect(notifications).toBeFocused();
  await notifications
    .getByRole('button', { name: /^Actions for/ })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Remove notification', exact: true }).click();
  await expect(notifications.getByRole('button', { name: /^Mark unread:/ })).toHaveCount(4);
  await expect(notifications).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(notifications).toBeHidden();
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeFocused();
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
  await expect(page).toHaveURL(`${app.url}/en/stores/${store}/reference/venues`);
  await expect(page.getByRole('menuitem', { name: 'Venues', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Aurora single-column navigation supports collapse, keyboard and responsive drawers', async ({
  page,
  app,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${app.url}/en/stores/${store}/reference/events/${event}/edit`);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Sofia Creative Forum');
  const sidenav = page.getByRole('navigation', { name: 'Workspace navigation' });
  const drawer = sidenav.locator('.MuiDrawer-paper');
  await expect(drawer).toHaveCSS('width', '256px');
  await expect(sidenav.getByRole('menuitem', { name: 'Products', exact: true })).toBeVisible();
  await expect(sidenav.getByRole('menuitem', { name: 'Events', exact: true })).toBeVisible();
  await expect(page.getByLabel('Data source: Real', { exact: true })).toBeVisible();
  await expect(page.getByText(/^holita · \d{4}$/)).toHaveCount(0);
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
  await page.getByRole('button', { name: 'Collapse navigation', exact: true }).click();
  await expect(drawer).toHaveCSS('width', '72px');
  await page.screenshot({
    path: testInfo.outputPath('desktop-collapsed.png'),
    animations: 'disabled',
  });
  const events = sidenav.getByRole('menuitem', { name: 'Events', exact: true });
  await events.hover();
  await expect(page.getByRole('tooltip', { name: 'Events', exact: true })).toBeVisible();
  await expect(drawer).toHaveCSS('width', '72px');
  await events.focus();
  await events.press('Enter');
  await expect(page).toHaveURL(`${app.url}/en/stores/${store}/reference/events`);
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  await expect(drawer).toHaveCSS('width', '72px');
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).click();
  await expect(drawer).toHaveCSS('width', '256px');

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(drawer).toHaveCSS('width', '72px');
  await page.screenshot({ path: testInfo.outputPath('tablet.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).click();
  await expect(drawer).toHaveCSS('width', '256px');
  await sidenav.getByRole('menuitem', { name: 'Venues', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/stores/${store}/reference/venues`);
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
  await expect(drawer).toHaveCSS('width', '256px');
});

test('open search follows the current trigger across the mobile breakpoint', async ({
  page,
  app,
}, testInfo) => {
  const invalidAnchors: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('anchorEl')) invalidAnchors.push(message.text());
  });
  await page.setViewportSize({ width: 899, height: 900 });
  await page.goto(`${app.url}/en/stores/${store}/reference/events`);
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'Search workspace', exact: true });
  const input = search.getByRole('textbox', { name: 'Search workspace', exact: true });
  await input.fill('Venues');

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(input).toHaveValue('Venues');
  await expect(input).toBeFocused();
  const trigger = page.locator('input[aria-label="Search"]');
  await expect
    .poll(async () => {
      const panel = await search.boundingBox();
      const field = await page.locator('.MuiTextField-root').filter({ has: trigger }).boundingBox();
      return panel !== null && field !== null && Math.abs(panel.x - field.x) < 1;
    })
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('search-resize-900.png'),
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.press('Enter');
  await input.fill('Tags');
  await page.setViewportSize({ width: 899, height: 900 });
  await expect(input).toHaveValue('Tags');
  await expect(input).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath('search-resize-899.png'),
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeFocused();
  expect(invalidAnchors).toEqual([]);

  const navigation = page.getByRole('dialog', { name: 'Navigation', exact: true });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(navigation).toBeVisible();
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(navigation).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  const drawer = page
    .getByRole('navigation', { name: 'Workspace navigation' })
    .locator('.MuiDrawer-paper');
  await expect(drawer).toHaveCSS('width', '72px');
  await page.setViewportSize({ width: 1199, height: 900 });
  await expect(drawer).toHaveCSS('width', '72px');
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(drawer).toHaveCSS('width', '256px');
  await page.getByRole('button', { name: 'Collapse navigation', exact: true }).click();
  await page.setViewportSize({ width: 1199, height: 900 });
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).click();
  await expect(drawer).toHaveCSS('width', '256px');
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(drawer).toHaveCSS('width', '72px');
});

test('shell examples preserve an Event draft and respect search and store navigation blockers', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/stores/${store}/reference/events/${event}/edit`);
  const title = page.getByLabel('Title', { exact: true });
  await expect(title).toHaveValue('Sofia Creative Forum');
  await title.fill('Unsaved shell review');
  const editorUrl = page.url();
  const profile = page.getByRole('button', { name: 'Profile', exact: true });
  await profile.click();
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Preferences', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await expect(profile).toBeFocused();
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /Български/ }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await page.getByRole('button', { name: 'Mark all as read', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(editorUrl);
  await expect(title).toHaveValue('Unsaved shell review');
  await expect(page.getByRole('status')).toHaveText('Unsaved changes');

  const trigger = page.getByRole('textbox', { name: 'Search', exact: true });
  await trigger.click();
  const search = page.getByRole('dialog', { name: 'Search workspace', exact: true });
  await search.getByRole('button', { name: /^Venues Workspace/ }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page).toHaveURL(editorUrl);
  await expect(title).toHaveValue('Unsaved shell review');

  const storeSelector = page.getByRole('combobox', { name: 'Store', exact: true });
  await storeSelector.click();
  await page.getByRole('option', { name: 'holita Plovdiv', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(storeSelector).toHaveText('holita Sofia');
  await expect(title).toHaveValue('Unsaved shell review');
  await storeSelector.click();
  await page.getByRole('option', { name: 'holita Plovdiv', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page).toHaveURL(
    `${app.url}/en/stores/10000000-0000-4000-8000-000000000002/reference/events`,
  );
  await expect(
    page.getByRole('link', { name: 'Plovdiv Culture Exchange', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toHaveCount(
    0,
  );
});
