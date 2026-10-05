import { expect, type Locator } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';

async function finishAnimations(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
}

test('Sakai desktop navigation, persisted theme and language preserve the real store route', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${app.url}/en/stores/${storeA}/products?review=1#main-content`);
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.locator('aside').getByRole('link', { name: 'Products', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: testInfo.outputPath('desktop-light.png'), fullPage: true });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('aside')).toHaveCount(0);
  await menu.click();
  await expect(page.locator('aside')).toBeVisible();
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  await expect(page.locator('html')).toHaveClass('app-dark');
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveClass('app-dark');
  await finishAnimations(page.locator('p-select'));
  await page.screenshot({ path: testInfo.outputPath('desktop-dark.png'), fullPage: true });
  await page.getByRole('link', { name: 'Български', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/bg/stores/${storeA}/products?review=1#main-content`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await expect(page.getByRole('combobox', { name: 'Магазин', exact: true })).toContainText(
    'holita Sofia',
  );
  await page.getByRole('button', { name: 'Включи светла тема', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass('app-dark');
  expect(errors).toEqual([]);
});

test('mobile drawer traps focus, closes on Escape, backdrop, navigation and desktop resize', async ({
  page,
  app,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${app.url}/en/stores/${storeA}/products`);
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile-light.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  const drawer = page.getByRole('complementary', { name: 'Navigation', exact: true });
  await menu.click();
  await expect(drawer).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(drawer.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: 'Products', exact: true })).toBeFocused();
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
  await finishAnimations(page.locator('p-select'));
  await page.screenshot({ path: testInfo.outputPath('mobile-dark.png'), fullPage: true });
  await menu.click();
  await expect(drawer).toBeVisible();
  await finishAnimations(drawer);
  await page.screenshot({ path: testInfo.outputPath('mobile-menu.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(drawer).not.toBeVisible();
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/p-overflow-hidden/);
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
});
