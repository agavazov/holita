import { expect } from '@playwright/test';
import { join } from 'node:path';
import { workspaceRoot } from '../graphql/contracts.mjs';
import { chooseBranch, chooseLanguage, setDarkTheme, test } from './angular-fixture.mjs';

test('shows reference labels and last-known summary and opens every location field in both themes and viewport sizes', async ({
  page,
  app,
}) => {
  const headers: Record<string, string>[] = [];
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && request.postData()?.includes('AdminKarmaLocation')) {
      headers.push(request.headers());
    }
  });
  await page.goto(`${app.url}/en/karma-client/cars/41`);
  const summary = page.getByRole('region', { name: 'Truck summary', exact: true });
  await expect(summary).toContainText('Fixture project (12)');
  await expect(summary).toContainText('Europe/Sofia (8)');
  const source = page.locator('holita-car-details details');
  await expect(source).not.toHaveAttribute('open');
  await source.locator('summary').click();
  await expect(source.locator('dd')).toContainText(['8']);
  await expect(source.locator('dd')).toHaveCount(10);
  await expect(page.locator('.location-summary')).toContainText('2026-01-01 09:59:00');
  await page.getByRole('link', { name: 'Location', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41/location`);
  await page.locator('holita-location-page summary').click();
  await expect(page.locator('holita-location-page dd')).toHaveCount(13);
  await expect(page.locator('holita-location-page dd')).toHaveText([
    'KARMA TEST 41',
    '41',
    '000123456789012',
    '3000000600',
    '0',
    '2026-01-01 09:59:00',
    '2026-01-01 11:59:00',
    '2026-01-01 09:59:00',
    '0',
    '0',
    '0',
    '0',
    '<b>Fixture plain text</b>',
  ]);
  expect(await page.locator('holita-location-page dl b').count()).toBe(0);
  const map = page.getByRole('link', { name: 'Open in Google Maps', exact: true });
  await expect(map).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=0%2C0',
  );
  await expect(map).toHaveAttribute('rel', 'noopener noreferrer');
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark']) {
      await expect(page.locator('holita-location-page dl')).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      if (process.env.HOLITA_BROWSER_SCREENSHOTS === '1') {
        await page.screenshot({
          path: join(
            workspaceRoot,
            '.references/review',
            `karma-location-${viewport.name}-${theme}.png`,
          ),
          fullPage: true,
          animations: 'disabled',
        });
      }
      await setDarkTheme(page, theme === 'light');
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const before = headers.length;
  await chooseBranch(page, 'Sandbox');
  expect(headers).toHaveLength(before);
  await page.reload();
  await expect(map).toBeVisible();
  await chooseLanguage(page, 'Български');
  await expect(page.getByRole('heading', { name: 'Местоположение', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Обзор', exact: true }).click();
  await expect(page.getByRole('link', { name: 'eData', exact: true })).toBeVisible();
  expect(
    headers.every(
      (header) =>
        !('x-branch-id' in header) && header['authorization'] === `Bearer ${app.demoSession.token}`,
    ),
  ).toBe(true);
});

test('retains location on failed refresh and handles null, invalid and absent coordinates and missing trucks', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/karma-client/cars/41/location`);
  const map = page.getByRole('link', { name: 'Open in Google Maps', exact: true });
  await expect(map).toBeVisible();
  app.karma.setFailed(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Karma is unavailable');
  await expect(map).toBeVisible();
  app.karma.setFailed(false);
  app.karma.setLocationCoordinates(null, null);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(map).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(
    'No valid coordinates are available for this map.',
  );
  app.karma.setLocationCoordinates(91, 0);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('dd')).toContainText([
    'KARMA TEST 41',
    '41',
    '000123456789012',
    '3000000600',
    '0',
    '2026-01-01 09:59:00',
    '2026-01-01 11:59:00',
    '2026-01-01 09:59:00',
    '91',
    '0',
    '0',
    '0',
    '<b>Fixture plain text</b>',
  ]);
  await expect(map).toHaveCount(0);
  app.karma.setLocationEmpty(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No last-known location data.');
  await expect(page.locator('dd')).toHaveCount(0);
  await page.goto(`${app.url}/en/karma-client/cars/999/location`);
  await expect(page.getByRole('alert')).toContainText('Truck not found in Karma.');
  const before = app.karma.requests.length;
  await page.goto(`${app.url}/en/karma-client/cars/not-an-id/location`);
  await expect(page.getByRole('alert')).toContainText('Truck not found in Karma.');
  expect(app.karma.requests).toHaveLength(before);
});

test('navigates separate account menus, pages and searches the complete references and preserves URL through reload/language', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/karma-client/projects`);
  await expect(page.getByRole('cell', { name: 'Fixture project', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Time zones', exact: true }).click();
  const rows = page.locator('holita-time-zones-page tbody tr');
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText('Fixture/Zone000');
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows.first()).toContainText('Fixture/Zone050');
  await expect(page).toHaveURL(/first=50/);
  await page.reload();
  await expect(rows.first()).toContainText('Fixture/Zone050');
  await page.getByRole('combobox', { name: 'Rows per page', exact: true }).click();
  await page.getByRole('option', { name: '100', exact: true }).click();
  await expect(rows).toHaveCount(100);
  await page.getByLabel('Search by ID or name', { exact: true }).fill('Europe/Sofia');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Europe/Sofia');
  await page.reload();
  await expect(rows).toContainText('Europe/Sofia');
  await chooseLanguage(page, 'Български');
  await expect(page.getByRole('heading', { name: 'Часови зони', exact: true })).toBeVisible();
  await expect(rows).toContainText('Europe/Sofia');
  await expect(page.getByLabel('Търсене по ID или име', { exact: true })).toHaveValue(
    'Europe/Sofia',
  );
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark']) {
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      if (process.env.HOLITA_BROWSER_SCREENSHOTS === '1') {
        await page.screenshot({
          path: join(
            workspaceRoot,
            '.references/review',
            `karma-time-zones-${viewport.name}-${theme}.png`,
          ),
          fullPage: true,
          animations: 'disabled',
        });
      }
      await setDarkTheme(page, theme === 'light');
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByLabel('Търсене по ID или име', { exact: true }).fill('missing');
  await page.getByRole('button', { name: 'Търси', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Няма намерени записи.', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Информация за API', exact: true }).click();
  await expect(page.locator('dd')).toHaveText(['2.26.1.1']);
  app.karma.setFailed(true);
  await page.getByRole('button', { name: 'Обнови', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('dd')).toHaveText(['2.26.1.1']);
  app.karma.setFailed(false);
  await page.getByRole('button', { name: 'Опитай отново', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('keeps trucks readable during lookup failure and recovers resolved names', async ({
  page,
  app,
}) => {
  app.karma.setReferencesFailed(true);
  await page.goto(`${app.url}/en/karma-client/cars`);
  await expect(page.getByRole('link', { name: 'KARMA TEST 41', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Reference names are unavailable');
  app.karma.setReferencesFailed(false);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Fixture project (12)', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Europe/Sofia (8)', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test.describe('with Fleet disabled', () => {
  test.use({ fleetEnabled: false });
  test('keeps all Phase 2 views available', async ({ page, app }) => {
    for (const [path, heading] of [
      ['cars/41/location', 'Location'],
      ['projects', 'Projects'],
      ['time-zones', 'Time zones'],
      ['api-info', 'API information'],
    ] as const) {
      await page.goto(`${app.url}/en/karma-client/${path}`);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
  });
});

test.describe('signed out', () => {
  test.use({ demoSignedIn: false });
  test('never reads Phase 2 upstream data from deep links', async ({ page, app }) => {
    for (const path of ['cars/41/location', 'projects', 'time-zones', 'api-info']) {
      await page.goto(`${app.url}/en/karma-client/${path}`);
      await expect(page.getByTestId('demo-login')).toBeVisible();
    }
    expect(app.karma.requests).toEqual([]);
  });
});
