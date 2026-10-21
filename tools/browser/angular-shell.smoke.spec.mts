import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { chooseBranch, chooseMenuItem, setDarkTheme, test } from './angular-fixture.mjs';

const branchA = '10000000-0000-4000-8000-000000000001';

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env['HOLITA_BROWSER_SCREENSHOTS'] === '1') {
    await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
  }
}

test.beforeEach(async ({ page, app }) => {
  for (const [branchId, licensePlate] of [
    ['10000000-0000-4000-8000-000000000001', 'Discordia truck'],
    ['10000000-0000-4000-8000-000000000002', 'Sandbox truck'],
  ] as const) {
    const response = await page.request.post(app.gatewayUrl, {
      headers: { authorization: `Bearer ${app.demoSession.token}`, 'x-branch-id': branchId },
      data: {
        query: 'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id}}',
        variables: { input: { licensePlate } },
      },
    });
    const body: unknown = await response.json();
    expect(body).toHaveProperty('data.createFleetVehicle.id');
  }
});

/** A `--p-app-*` (or other) length token in CSS pixels, read from the running theme. */
async function tokenPx(page: Page, name: string): Promise<number> {
  return page.evaluate((property) => {
    const root = getComputedStyle(document.documentElement);
    const value = root.getPropertyValue(property).trim();
    const rem = Number.parseFloat(root.fontSize);
    const number = Number.parseFloat(value);
    if (value.endsWith('rem')) {
      return number * rem;
    }
    if (value.endsWith('px')) {
      return number;
    }
    throw new Error(`Unsupported token ${property}: ${value}`);
  }, name);
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  if (!bounds) {
    throw new Error('Element has no box.');
  }
  return bounds;
}

async function finishAnimations(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    // Dynamic theme styles can cancel an animation; cancellation also ends that animation.
    await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
  });
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

async function expectVisibleFocus(target: Locator): Promise<void> {
  const focus = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      visible: element.matches(':focus-visible'),
      width: Number.parseFloat(style.outlineWidth),
      style: style.outlineStyle,
      color: style.outlineColor,
    };
  });
  expect(focus.visible).toBe(true);
  expect(focus.width).toBeGreaterThan(0);
  expect(focus.style).not.toBe('none');
  expect(focus.color).not.toBe('rgba(0, 0, 0, 0)');
}

test('shell geometry follows the theme tokens: root, topbar, sidebar, rail, frame and content', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${app.url}/en/${branchA}/fleet/vehicles`);
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveCSS('font-size', '16px');
  expect(
    await page.evaluate(async () => {
      const fonts = await document.fonts.load('400 14px Lato', 'Клонове Vehicles');
      return fonts.length > 0 && fonts.every((font) => font.status === 'loaded');
    }),
  ).toBe(true);
  const gap = await tokenPx(page, '--p-app-frame-gap');
  const radius = await tokenPx(page, '--p-app-radius-frame');
  const topbar = page.locator('.app-topbar__bar');
  const aside = page.locator('aside#desktop-navigation');
  const main = page.locator('main#main-content');
  expect((await box(topbar)).height).toBeCloseTo(await tokenPx(page, '--p-app-topbar-height'), 0);
  expect((await box(aside)).width).toBeCloseTo(await tokenPx(page, '--p-app-sidebar-width'), 0);
  expect(gap).toBe(8);
  expect((await box(topbar)).y).toBeCloseTo(gap, 0);
  const frame = await box(main);
  expect(1440 - (frame.x + frame.width)).toBeCloseTo(gap, 0);
  await expect(topbar).toHaveCSS('border-top-left-radius', `${String(radius)}px`);
  await expect(main).toHaveCSS('border-bottom-right-radius', `${String(radius)}px`);
  await capture(page, testInfo, 'desktop-1440.png');

  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await finishAnimations(aside);
  expect((await box(aside)).width).toBeCloseTo(
    await tokenPx(page, '--p-app-sidebar-rail-width'),
    0,
  );
  // Rail links keep their names and show them as tooltips on focus.
  const vehiclesLink = aside.getByRole('link', { name: 'Vehicles', exact: true });
  await vehiclesLink.focus();
  await expect(page.locator('.p-tooltip')).toContainText('Vehicles');
  expect(await noHorizontalOverflow(page)).toBe(true);
  await capture(page, testInfo, 'desktop-rail.png');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  expect((await box(aside)).width).toBeCloseTo(
    await tokenPx(page, '--p-app-sidebar-rail-width'),
    0,
  );
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');

  await page.setViewportSize({ width: 2560, height: 1440 });
  const content = await box(page.locator('.app-page'));
  const area = await box(main);
  expect(content.width).toBeLessThanOrEqual(await tokenPx(page, '--p-app-content-max-width'));
  expect(
    Math.abs(content.x - area.x - (area.x + area.width - content.x - content.width)),
  ).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('CSS and TypeScript switch to the navigation drawer at the same pixel', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/${branchA}/fleet/vehicles`);
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  const columns = () =>
    page
      .locator('.app-shell')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  await page.setViewportSize({ width: 1023, height: 800 });
  await expect(page.locator('#desktop-navigation')).toHaveCount(0);
  await expect(page.locator('.app-topbar__logo')).toBeVisible();
  expect(await columns()).toBe(1);
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.locator('#desktop-navigation')).toBeVisible();
  await expect(page.locator('.app-topbar__logo')).toHaveCount(0);
  expect(await columns()).toBe(2);
});

test('one Branch menu stays on the topbar row and the editor keeps drafts across widths', async ({
  page,
  app,
}, testInfo) => {
  await page.goto(`${app.url}/en/${branchA}/fleet/vehicles`);
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  const select = page.locator('holita-admin-topbar').getByRole('button', { name: /^Branch:/ });
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  for (const width of [320, 390, 768, 1023, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(select).toHaveCount(1);
    await expect(select).toContainText('Discordia');
    expect(await noHorizontalOverflow(page)).toBe(true);
    const selectBox = await box(select);
    const menuBox = await box(menu);
    expect(
      Math.abs(selectBox.y + selectBox.height / 2 - (menuBox.y + menuBox.height / 2)),
    ).toBeLessThanOrEqual(2);
  }
  await page.setViewportSize({ width: 1023, height: 844 });
  await select.click();
  await expect(select).toHaveAttribute('aria-expanded', 'true');
  await page.setViewportSize({ width: 1024, height: 844 });
  await expect(select).toHaveCount(1);
  await expect(select).toContainText('Discordia');
  await expect(page.locator('#desktop-navigation')).toBeVisible();
  await expect(select).toHaveAttribute('aria-expanded', 'false');
  await select.click();
  await expect(page.getByRole('menuitem', { name: /^Discordia/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(select).toBeFocused();
  await page
    .locator('holita-page-header')
    .getByRole('button', { name: 'New vehicle', exact: true })
    .click();
  const plate = page.getByRole('textbox', { name: /^License plate/ });
  await plate.fill('Unsaved responsive draft');
  for (const width of [320, 390, 768, 1023, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(plate).toHaveValue('Unsaved responsive draft');
    expect(await noHorizontalOverflow(page)).toBe(true);
  }
  await capture(page, testInfo, 'editor-1024.png');
  await expect(plate).toHaveValue('Unsaved responsive draft');
  await expect(page).toHaveURL(`${app.url}/en/${branchA}/fleet/vehicles/new`);
});

test('no horizontal overflow on the list from 320 to 1440 px', async ({ page, app }, testInfo) => {
  await page.goto(`${app.url}/en/${branchA}/fleet/vehicles`);
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.app-shell')).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await capture(page, testInfo, 'mobile-375.png');
});

test('keyboard order and visible focus in both themes on desktop and mobile', async ({
  page,
  app,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${app.url}/en/${branchA}/fleet/vehicles`);
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  const logo = page.getByRole('link', { name: 'holita', exact: true });
  const select = page.locator('holita-admin-topbar').getByRole('button', { name: /^Branch:/ });
  const language = page.locator('holita-admin-topbar').getByRole('button', { name: /^Language:/ });
  const notifications = page
    .locator('holita-admin-topbar')
    .getByRole('button', { name: 'Notifications · Demo', exact: true });
  const account = page.locator('holita-admin-topbar').getByRole('button', { name: /^Account:/ });
  const firstNavigationLink = page
    .locator('aside')
    .getByRole('link', { name: 'Overview', exact: true });
  for (const theme of ['light', 'dark'] as const) {
    await setDarkTheme(page, theme === 'dark');
    // The skip link is the first focusable element, right before the menu button.
    await menu.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(skip).toBeFocused();
    await expectVisibleFocus(skip);
    // The banner precedes the complementary navigation; the logo leads the sidebar from lg.
    for (const target of [
      menu,
      select,
      language,
      notifications,
      account,
      logo,
      firstNavigationLink,
    ]) {
      await page.keyboard.press('Tab');
      await expect(target).toBeFocused();
      await expectVisibleFocus(target);
    }
    await expect(firstNavigationLink).not.toHaveAttribute('aria-current', 'page');
    await expect(
      page.locator('aside').getByRole('link', { name: 'Vehicles', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await account.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(
      page.getByRole('menuitem', {
        name: theme === 'light' ? 'Use dark theme' : 'Use light theme',
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(account).toBeFocused();
    await expectVisibleFocus(account);
  }
  await setDarkTheme(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#desktop-navigation')).toHaveCount(0);
  await menu.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(skip).toBeFocused();
  for (const target of [menu, logo, select, language, notifications, account]) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    await expectVisibleFocus(target);
  }
});

test('mobile navigation drawer traps focus and closes on Escape, backdrop, navigation and resize', async ({
  page,
  app,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${app.url}/en/${branchA}/fleet/vehicles`);
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  // The desktop sidebar is also a "Navigation" landmark, so the drawer is matched by its class too.
  const drawer = page
    .getByRole('complementary', { name: 'Navigation', exact: true })
    .and(page.locator('.app-nav-drawer'));
  const close = drawer.getByRole('button', { name: 'Close navigation', exact: true });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(drawer).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(close).toBeFocused();
  const linkNames = [
    'Overview',
    'Alerts',
    'Trip log',
    'Vehicles',
    'Drivers',
    'Devices',
    'Maintenance',
    'Trucks',
    'Users',
    'Roles',
    'Projects',
    'Time zones',
    'API information',
    'Vehicle groups',
    'General',
  ];
  for (const name of linkNames) {
    await page.keyboard.press('Tab');
    await expect(drawer.getByRole('link', { name, exact: true })).toBeFocused();
  }
  await expectVisibleFocus(drawer.getByRole('link', { name: 'General', exact: true }));
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: 'General', exact: true })).toBeFocused();
  await finishAnimations(drawer);
  await capture(page, testInfo, 'mobile-navigation.png');
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(menu).toBeFocused();
  await menu.click();
  await expect(drawer).toBeVisible();
  await page.locator('.p-drawer-mask').click({ position: { x: 380, y: 400 } });
  await expect(drawer).not.toBeVisible();
  await menu.click();
  await drawer.getByRole('link', { name: 'Devices', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await chooseBranch(page, 'Sandbox');
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await menu.click();
  await expect(drawer).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(drawer).not.toBeVisible();
  await expect(page.locator('aside#desktop-navigation')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/p-overflow-hidden/);
  await expect(menu).toBeFocused();

  await page.setViewportSize({ width: 320, height: 800 });
  for (const theme of ['light', 'dark']) {
    await menu.click();
    await expect(drawer).toBeVisible();
    await finishAnimations(drawer);
    expect((await box(drawer)).width).toBeCloseTo(await tokenPx(page, '--p-app-sidebar-width'), 0);
    await page.keyboard.press('Tab');
    await expectVisibleFocus(drawer.getByRole('link', { name: 'Overview', exact: true }));
    await capture(page, testInfo, `narrow-${theme}.png`);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    if (theme === 'light') {
      await setDarkTheme(page, true);
    }
  }
});

test('theme persists and the language menu keeps path, query and fragment', async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${app.url}/en/${branchA}/fleet/vehicles?review=1#main-content`);
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle('Vehicles · holita');
  const notifications = page
    .locator('holita-admin-topbar')
    .getByRole('button', { name: 'Notifications · Demo', exact: true });
  await expect(notifications.locator('.app-topbar__badge')).toHaveCount(0);
  await notifications.click();
  const notificationMenu = page.getByRole('menu', { name: 'Notifications · Demo', exact: true });
  await expect(notificationMenu).toBeVisible();
  await expect(
    page.locator('.menu-button__header').filter({ hasText: 'Notifications · Demo' }),
  ).toContainText('Notification delivery is unavailable until a real provider is connected.');
  await expect(notificationMenu.getByRole('menuitem')).toHaveCount(0);
  await notifications.click();
  await expect(notificationMenu).toBeHidden();
  await setDarkTheme(page, true);
  await expect(page.locator('html')).toHaveClass(/app-dark/);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/app-dark/);
  await page
    .locator('holita-admin-topbar')
    .getByRole('button', { name: /^Language:/ })
    .click();
  const language = page.getByRole('menuitem', { name: 'Български', exact: true });
  await expect(language.locator('[lang="bg"]')).toHaveText('Български');
  await chooseMenuItem(page, 'Български');
  await expect(page).toHaveURL(`${app.url}/bg/${branchA}/fleet/vehicles?review=1#main-content`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await expect(page).toHaveTitle('Автомобили · holita');
  const notificationsBg = page
    .locator('holita-admin-topbar')
    .getByRole('button', { name: 'Известия · Демо', exact: true });
  await expect(notificationsBg.locator('.app-topbar__badge')).toHaveCount(0);
  await notificationsBg.click();
  const notificationMenuBg = page.getByRole('menu', { name: 'Известия · Демо', exact: true });
  await expect(notificationMenuBg).toBeVisible();
  await expect(
    page.locator('.menu-button__header').filter({ hasText: 'Известия · Демо' }),
  ).toContainText('Изпращането на известия не е достъпно до свързване с реален доставчик.');
  await expect(notificationMenuBg.getByRole('menuitem')).toHaveCount(0);
  await notificationsBg.click();
  await expect(notificationMenuBg).toBeHidden();
  await expect(
    page.locator('holita-admin-topbar').getByRole('button', { name: /^Клон:/ }),
  ).toContainText('Discordia');
  await setDarkTheme(page, false);
  await expect(page.locator('html')).not.toHaveClass(/app-dark/);
  expect(errors).toEqual([]);
});

test('branch selection works with the keyboard and unknown branches expose no Fleet navigation', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/not-a-uuid/fleet/vehicles`);
  await expect(page.getByRole('alert')).toContainText('Branch not found');
  await expect(
    page.locator('aside').getByRole('link', { name: 'Vehicles', exact: true }),
  ).toHaveCount(0);
  const select = page.locator('holita-admin-topbar').getByRole('button', { name: /^Branch:/ });
  await select.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Discordia', exact: true })).toBeVisible();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('aside').getByRole('link', { name: 'Vehicles', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.goto(`${app.url}/en?review=1#main-content`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Overview', exact: true }),
  ).toBeVisible();
  await expect(page.locator('aside nav').getByRole('heading', { level: 2 })).toHaveText([
    'Monitoring',
    'Fleet',
    /^Karma Client/,
    'Settings',
  ]);
  await expect(page.getByRole('link', { name: 'Branches', exact: true })).toHaveCount(0);
  await expect(
    page.locator('aside').getByRole('link', { name: 'Overview', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});
