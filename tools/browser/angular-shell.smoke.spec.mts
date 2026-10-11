import { expect, type Locator, type Page } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';

async function finishAnimations(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    // Dynamic theme styles can cancel an animation; cancellation also ends that animation.
    await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
  });
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => document.activeElement === element)) break;
  }
  await expect(target).toBeFocused();
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

test('Sakai desktop navigation, persisted theme and language preserve the real store route', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${app.url}/en/stores/${storeA}/products?review=1#main-content`);
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveCSS('font-size', '14px');
  await expect(page.locator('.layout-topbar')).toHaveCSS('height', '56px');
  await expect(page.locator('aside')).toHaveCSS('width', '280px');
  expect(
    await page.evaluate(async () => {
      const fonts = await document.fonts.load('400 14px Lato', 'Магазини Products');
      return fonts.length > 0 && fonts.every((font) => font.status === 'loaded');
    }),
  ).toBe(true);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await expect(page.locator('.layout-main')).toHaveCSS('width', '1504px');
  expect(
    await page.evaluate(() => {
      const main = document.querySelector('.layout-main')?.getBoundingClientRect();
      const container = document.querySelector('.layout-main-container');
      if (!main || !container) throw new Error('The Sakai content layout is missing');
      const bounds = container.getBoundingClientRect();
      return Math.abs(main.left - bounds.left - (bounds.right - main.right));
    }),
  ).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1280, height: 800 });
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.locator('aside').getByRole('link', { name: 'Products', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  const storesLink = page.locator('aside').getByRole('link', { name: 'Stores', exact: true });
  const logo = page.getByRole('link', { name: 'holita', exact: true });
  const select = page.getByRole('combobox', { name: 'Store', exact: true });
  const language = page.getByRole('link', { name: 'Български', exact: true });
  const theme = page.getByRole('button', { name: 'Use dark theme', exact: true });
  await logo.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(menu).toBeFocused();
  await expectVisibleFocus(menu);
  await page.keyboard.press('Tab');
  await expect(logo).toBeFocused();
  await expectVisibleFocus(logo);
  await page.keyboard.press('Tab');
  await expect(select).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(language).toBeFocused();
  await expectVisibleFocus(language);
  await page.keyboard.press('Tab');
  await expect(theme).toBeFocused();
  await expectVisibleFocus(theme);
  await page.keyboard.press('Tab');
  await expect(storesLink).toBeFocused();
  await expectVisibleFocus(storesLink);
  await expect(page.locator('.p-datatable-mask')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('desktop-light.png'), fullPage: true });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('aside')).toHaveAttribute('inert', '');
  await expect(page.locator('aside')).toBeHidden();
  await theme.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Navigation', exact: true })).toHaveCount(0);
  await finishAnimations(page.locator('.layout-main-container'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('desktop-collapsed.png'), fullPage: true });
  await menu.click();
  await expect(page.locator('aside')).toBeVisible();
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  await expect(page.locator('html')).toHaveClass('app-dark');
  await menu.focus();
  await tabTo(page, language);
  await expectVisibleFocus(language);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Use light theme', exact: true })).toBeFocused();
  await expectVisibleFocus(page.getByRole('button', { name: 'Use light theme', exact: true }));
  await menu.focus();
  await tabTo(page, storesLink);
  await expectVisibleFocus(storesLink);
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveClass('app-dark');
  await finishAnimations(page.locator('.store-selector p-select'));
  await expect(page.locator('.p-datatable-mask')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('desktop-dark.png'), fullPage: true });
  await page.getByRole('link', { name: 'Български', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/bg/stores/${storeA}/products?review=1#main-content`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await expect(page.getByRole('combobox', { name: 'Магазин', exact: true })).toContainText(
    'holita Sofia',
  );
  await page.getByRole('button', { name: 'Включи светла тема', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass('app-dark');
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await finishAnimations(page.locator('.store-selector p-select'));
  await page.screenshot({ path: testInfo.outputPath('desktop-bg.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('mobile drawer traps focus, closes on Escape, backdrop, navigation and desktop resize', async ({
  page,
  app,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${app.url}/en/stores/${storeA}/products`);
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await expect(page.locator('.p-datatable-mask')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('mobile-light.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  const drawer = page.getByRole('complementary', { name: 'Navigation', exact: true });
  await page.getByRole('link', { name: 'holita', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(menu).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'holita', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  const language = page.getByRole('link', { name: 'Български', exact: true });
  await expect(language).toBeFocused();
  await expectVisibleFocus(language);
  await page.keyboard.press('Tab');
  const theme = page.getByRole('button', { name: 'Use dark theme', exact: true });
  await expect(theme).toBeFocused();
  await expectVisibleFocus(theme);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Store', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeFocused();
  await menu.click();
  await expect(drawer).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(drawer.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused();
  const storesLink = drawer.getByRole('link', { name: 'Stores', exact: true });
  await page.keyboard.press('Tab');
  await expectVisibleFocus(storesLink);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: 'Events', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: 'Vehicles', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: 'Tags', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: 'Speakers', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: 'Venues', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: 'Products', exact: true })).toBeFocused();
  for (const name of ['Venues', 'Speakers', 'Tags', 'Vehicles', 'Events']) {
    await page.keyboard.press('Tab');
    await expect(drawer.getByRole('link', { name, exact: true })).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(drawer.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(menu).toBeFocused();
  await menu.click();
  await expect(drawer).toBeVisible();
  await page.locator('.p-drawer-mask').click({ position: { x: 380, y: 400 } });
  await expect(drawer).not.toBeVisible();
  await menu.click();
  await drawer.getByRole('link', { name: 'Stores', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stores', exact: true })).toBeVisible();
  await chooseStore(page, 'holita Plovdiv');
  await expect(page.getByRole('cell', { name: 'Plovdiv notebook', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  await finishAnimations(page.locator('.store-selector p-select'));
  await expect(page.locator('.p-datatable-mask')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('mobile-dark.png'), fullPage: true });
  await menu.click();
  await expect(drawer).toBeVisible();
  await finishAnimations(drawer);
  await page.keyboard.press('Tab');
  await expect(storesLink).toBeFocused();
  await expectVisibleFocus(storesLink);
  await page.screenshot({ path: testInfo.outputPath('mobile-menu.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(drawer).not.toBeVisible();
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/p-overflow-hidden/);
});

test('responsive Sakai shell preserves editor drafts and one store selector across the breakpoint', async ({
  page,
  app,
}, testInfo) => {
  await page.goto(`${app.url}/en/stores/${storeA}/products/new`);
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('Unsaved responsive draft');
  const select = page.getByRole('combobox', { name: 'Store', exact: true });
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  for (const width of [320, 390, 768, 991]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(select).toHaveCount(1);
    await expect(select).toContainText('holita Sofia');
    await expect(name).toHaveValue('Unsaved responsive draft');
    await finishAnimations(page.locator('.layout-main-container'));
    const layout = await page.evaluate(() => {
      const header = document.querySelector('.layout-topbar');
      const card = document.querySelector('.card');
      if (!header || !card) throw new Error('The responsive Sakai layout is missing');
      const content = card.getBoundingClientRect();
      return {
        left: content.left,
        right: innerWidth - content.right,
        gap: content.top - header.getBoundingClientRect().bottom,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(layout).toEqual({ left: 28, right: 28, gap: 28, overflow: false });
  }
  await page.screenshot({ path: testInfo.outputPath('tablet-editor.png'), fullPage: true });
  await select.click();
  await expect(select).toHaveAttribute('aria-expanded', 'true');
  await page.setViewportSize({ width: 992, height: 844 });
  await expect(page.getByRole('listbox', { includeHidden: true })).toHaveCount(0);
  await expect(select).toHaveCount(1);
  await expect(select).toContainText('holita Sofia');
  await expect(page.locator('#desktop-navigation')).toBeVisible();
  await expect(name).toHaveValue('Unsaved responsive draft');
  await page.setViewportSize({ width: 991, height: 844 });
  await expect(page.locator('#desktop-navigation')).toHaveCount(0);
  await menu.click();
  const drawer = page.getByRole('complementary', { name: 'Navigation', exact: true });
  await expect(drawer).toBeVisible();
  await page.setViewportSize({ width: 992, height: 844 });
  await expect(drawer).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/p-overflow-hidden/);
  await expect(menu).toBeFocused();
  await expect(name).toHaveValue('Unsaved responsive draft');
  await expect(select).toContainText('holita Sofia');
  await expect(page).toHaveURL(`${app.url}/en/stores/${storeA}/products/new`);
});

test('Drawer uses its responsive panel width at 320 px in light and dark themes', async ({
  page,
  app,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${app.url}/en/stores/${storeA}/products`);
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  const drawer = page.getByRole('complementary', { name: 'Navigation', exact: true });
  for (const theme of ['light', 'dark']) {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await menu.click();
    await expect(drawer).toBeVisible();
    await finishAnimations(drawer);
    expect(await drawer.evaluate((element) => element.getBoundingClientRect().width)).toBe(280);
    await page.keyboard.press('Tab');
    await expectVisibleFocus(drawer.getByRole('link', { name: 'Stores', exact: true }));
    await page.screenshot({ path: testInfo.outputPath(`narrow-${theme}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Navigation', exact: true, includeHidden: true }),
    ).toHaveCount(0);
    await expect(menu).toBeFocused();
    if (theme === 'light')
      await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  }
});

test('store selection works with the keyboard and unknown stores expose no Products navigation', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/stores/not-a-uuid/products`);
  await expect(page.getByRole('alert')).toContainText('Store not found');
  await expect(
    page.locator('aside').getByRole('link', { name: 'Products', exact: true }),
  ).toHaveCount(0);
  const select = page.getByRole('combobox', { name: 'Store', exact: true });
  await select.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await expect(
    page.locator('aside').getByRole('link', { name: 'Products', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.goto(`${app.url}/en?review=1#main-content`);
  await expect(page.getByRole('heading', { name: 'Stores', exact: true })).toBeVisible();
  await expect(
    page.locator('aside').getByRole('link', { name: 'Stores', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.locator('aside').getByRole('link', { name: 'Products', exact: true }),
  ).toHaveCount(0);
});
