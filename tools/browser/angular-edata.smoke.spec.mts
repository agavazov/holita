import { expect } from '@playwright/test';
import { join } from 'node:path';
import { workspaceRoot } from '../graphql/contracts.mjs';
import { chooseBranch, chooseLanguage, setDarkTheme, test } from './angular-fixture.mjs';

test('browses all 600 messages with 50-row pages and restores pages on reload/back/language', async ({
  page,
  app,
}) => {
  const headers: Record<string, string>[] = [];
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && request.postData()?.includes('AdminKarmaEdata')) {
      headers.push(request.headers());
    }
  });
  await page.goto(`${app.url}/en/karma-client/cars/41`);
  await page.getByRole('link', { name: 'eData', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'eData', exact: true })).toBeVisible();
  const rows = page.locator('holita-edata-page section tbody tr');
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText('3000000600');
  const seen = new Set<string>();
  for (let index = 0; index < 12; index++) {
    await expect(rows.first()).toContainText(String(3000000600 - index * 50));
    const ids = await rows.locator('td:nth-child(2)').allTextContents();
    expect(ids).toHaveLength(50);
    ids.forEach((id) => {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    });
    if (index < 11) {
      await page.getByRole('button', { name: 'Older', exact: true }).click();
    }
  }
  expect(seen.size).toBe(600);
  await expect(page.getByRole('button', { name: 'Older', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Newer', exact: true }).click();
  await expect(rows.first()).toContainText('3000000100');
  await page.reload();
  await expect(rows.first()).toContainText('3000000100');
  await page.getByRole('button', { name: 'Newer', exact: true }).click();
  await expect(rows.first()).toContainText('3000000150');
  await page.goBack();
  await expect(rows.first()).toContainText('3000000100');
  const before = headers.length;
  await chooseBranch(page, 'Sandbox');
  expect(headers).toHaveLength(before);
  await chooseLanguage(page, 'Български');
  await expect(rows.first()).toContainText('3000000100');
  await page.getByRole('button', { name: 'Последни', exact: true }).click();
  await expect(rows.first()).toContainText('3000000600');
  expect(
    headers.every(
      (value) =>
        !('x-branch-id' in value) && value['authorization'] === `Bearer ${app.demoSession.token}`,
    ),
  ).toBe(true);
});

test('filters UTC dates and IDs, changes page size and shows every message field on desktop/mobile in both themes', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/karma-client/cars/41/edata`);
  await expect(page.getByRole('button', { name: 'Older', exact: true })).toBeEnabled();
  await page.getByRole('combobox', { name: 'Records per page', exact: true }).click();
  await page.getByRole('option', { name: '25', exact: true }).click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.locator('holita-edata-page section tbody tr')).toHaveCount(25);
  await page.getByLabel('From (UTC)', { exact: true }).fill('2026-01-01T00:00');
  await page.getByLabel('To (UTC)', { exact: true }).fill('2026-01-01T00:00');
  await page.getByLabel('Parameter IDs', { exact: true }).fill('99999');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.locator('holita-edata-page section tbody tr')).toHaveCount(1);
  const view = page.getByRole('button', { name: 'View message 3000000001', exact: true });
  const dialog = page.getByRole('dialog', { name: 'eData message details', exact: true });
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of ['light', 'dark']) {
      await expect(view).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      if (process.env.HOLITA_BROWSER_SCREENSHOTS === '1') {
        await page.screenshot({
          path: join(
            workspaceRoot,
            '.references/review',
            `karma-edata-${viewport.name}-${theme}.png`,
          ),
          fullPage: true,
          animations: 'disabled',
        });
      }
      await view.click();
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('dd')).toHaveText([
        '3000000001',
        '41',
        'KARMA TEST 41',
        '000123456789012',
        '2026-01-01 00:00:00',
        '2026-01-01 02:00:00',
        '2026-01-01 00:00:00',
        '0',
        '0',
        '0',
        '0',
      ]);
      const parameter = dialog.getByRole('cell', {
        name: 'Unlisted fixture parameter',
        exact: true,
      });
      await parameter.scrollIntoViewIfNeeded();
      await expect(parameter).toBeInViewport();
      if (process.env.HOLITA_BROWSER_SCREENSHOTS === '1') {
        await page.screenshot({
          path: join(
            workspaceRoot,
            '.references/review',
            `karma-edata-detail-${viewport.name}-${theme}.png`,
          ),
          fullPage: true,
          animations: 'disabled',
        });
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(view).toBeFocused();
      await setDarkTheme(page, theme === 'light');
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await expect(page.locator('holita-edata-page section tbody tr')).toHaveCount(1);
  await expect(page.getByLabel('Parameter IDs', { exact: true })).toHaveValue('99999');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('holita-edata-page section tbody tr')).toHaveCount(50);
  if (process.env.HOLITA_BROWSER_SCREENSHOTS === '1') {
    await page.screenshot({
      path: join(workspaceRoot, '.references/review', 'karma-edata-latest-desktop-light.png'),
      fullPage: true,
      animations: 'disabled',
    });
  }
});

test('recovers from refresh failure, preserves rows and handles empty, invalid and missing data', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/karma-client/cars/41/edata`);
  await expect(
    page.getByRole('button', { name: 'View message 3000000600', exact: true }),
  ).toBeVisible();
  app.karma.setFailed(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Karma is unavailable. Try again.');
  await expect(
    page.getByRole('button', { name: 'View message 3000000600', exact: true }),
  ).toBeVisible();
  app.karma.setFailed(false);
  app.karma.setEmpty(true);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'No eData messages for these filters.', exact: true }),
  ).toBeVisible();
  app.karma.setEmpty(false);
  await page.goto(`${app.url}/en/karma-client/cars/41/edata?size=500`);
  await expect(page.getByRole('alert')).toContainText('Invalid filters');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'View message 3000000600', exact: true }),
  ).toBeVisible();
  await page.goto(`${app.url}/en/karma-client/cars/999/edata`);
  await expect(page.getByRole('alert')).toContainText('Truck not found in Karma.');
});

test.describe('with Fleet disabled', () => {
  test.use({ fleetEnabled: false });
  test('keeps eData available independently', async ({ page, app }) => {
    await page.goto(`${app.url}/en/karma-client/cars/41/edata`);
    await expect(
      page.getByRole('button', { name: 'View message 3000000600', exact: true }),
    ).toBeVisible();
  });
});
