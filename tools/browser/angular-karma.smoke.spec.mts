import { expect } from '@playwright/test';
import { join } from 'node:path';
import { workspaceRoot } from '../graphql/contracts.mjs';
import { chooseBranch, chooseLanguage, setDarkTheme, test } from './angular-fixture.mjs';

test('searches trucks locally and preserves list context through car tabs and return navigation', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/karma-client/cars?size=25`);
  await expect(page.getByRole('link', { name: 'KARMA TEST 41', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  const table = page.locator('holita-karma-cars-page .p-datatable-table-container');
  const identity = table.locator('tbody td.app-col-identity').first();
  await identity.scrollIntoViewIfNeeded();
  const initial = await identity.boundingBox();
  expect(initial).not.toBeNull();
  expect(initial?.width).toBeLessThan(200);
  await table.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect.poll(async () => (await identity.boundingBox())?.x).toBe(initial?.x);
  await expect(identity.getByRole('link', { name: 'KARMA TEST 41', exact: true })).toBeInViewport();
  await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  const carReads = () =>
    app.karma.requests.filter((request) => request.path === '/apiv2/cars').length;
  const before = carReads();
  await page
    .getByLabel('Search by registration, car ID or device ID', { exact: true })
    .fill('missing');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'No trucks match the selected filters.', exact: true }),
  ).toBeVisible();
  expect(carReads()).toBe(before);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page
    .getByLabel('Search by registration, car ID or device ID', { exact: true })
    .fill('000123456789012');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=000123456789012/);
  await page.reload();
  await expect(
    page.getByLabel('Search by registration, car ID or device ID', { exact: true }),
  ).toHaveValue('000123456789012');
  await page.getByRole('link', { name: 'KARMA TEST 41', exact: true }).click();
  await expect(page).toHaveURL(/listQ=000123456789012/);
  await page.getByRole('link', { name: 'Location', exact: true }).click();
  await expect(page).toHaveURL(/\/41\/location\?.*listQ=000123456789012/);
  await expect(page.getByRole('link', { name: 'Location', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('link', { name: 'Trips', exact: true }).click();
  await expect(page).toHaveURL(/\/41\/trips\?.*listQ=000123456789012/);
  await page.getByRole('link', { name: 'Back to trucks', exact: true }).click();
  await expect(
    page.getByLabel('Search by registration, car ID or device ID', { exact: true }),
  ).toHaveValue('000123456789012');
  await expect(page).toHaveURL(/q=000123456789012/);
  await expect(page.getByRole('combobox', { name: 'Rows per page', exact: true })).toContainText(
    '25',
  );
});

test('opens truck details from the list, preserves scope through Branch/language changes and returns to the list', async ({
  page,
  app,
}) => {
  const headers: Record<string, string>[] = [];
  page.on('request', (request) => {
    if (
      request.url() === app.gatewayUrl &&
      request.postData()?.includes('"operationName":"AdminKarmaCar"')
    ) {
      headers.push(request.headers());
    }
  });
  await page.goto(`${app.url}/en/karma-client/cars`);
  await page.getByRole('link', { name: 'KARMA TEST 41', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41`);
  await expect(page.getByRole('heading', { name: 'Truck details', exact: true })).toBeVisible();
  const summary = page.getByRole('region', { name: 'Truck summary', exact: true });
  await expect(summary).toContainText('000123456789012');
  const source = page.locator('holita-car-details details');
  await expect(source).not.toHaveAttribute('open');
  await source.locator('summary').click();
  await expect(source).toContainText('Trailer');
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of ['light', 'dark']) {
      await expect(summary).toBeVisible();
      await expect(source.locator('dl')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      if (process.env.HOLITA_BROWSER_SCREENSHOTS === '1') {
        await page.screenshot({
          path: join(
            workspaceRoot,
            '.references/review',
            `karma-details-${viewport.name}-${theme}.png`,
          ),
          fullPage: true,
          animations: 'disabled',
        });
      }
      await setDarkTheme(page, theme === 'light');
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await chooseBranch(page, 'Sandbox');
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41`);
  expect(headers).toHaveLength(1);
  await page.reload();
  await expect(summary).toContainText('KARMA TEST 41');
  await chooseLanguage(page, 'Български');
  await expect(page).toHaveURL(`${app.url}/bg/karma-client/cars/41`);
  await expect(
    page.getByRole('heading', { name: 'Детайли за камиона', exact: true }),
  ).toBeVisible();
  expect(
    headers.every(
      (value) =>
        !('x-branch-id' in value) && value['authorization'] === `Bearer ${app.demoSession.token}`,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Към камионите', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Камиони', exact: true })).toBeVisible();
});

test('handles detail refresh failures and missing/invalid trucks', async ({ page, app }) => {
  await page.goto(`${app.url}/en/karma-client/cars/41`);
  const summary = page.getByRole('region', { name: 'Truck summary', exact: true });
  await expect(summary).toContainText('KARMA TEST 41');
  app.karma.setFailed(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Karma is unavailable. Try again.' }),
  ).toBeVisible();
  await expect(summary).toContainText('KARMA TEST 41');
  app.karma.setFailed(false);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.goto(`${app.url}/en/karma-client/cars/999`);
  await expect(page.getByRole('alert')).toContainText('Truck not found in Karma.');
  await expect(page.locator('dl')).toHaveCount(0);
  const reads = app.karma.requests.length;
  await page.goto(`${app.url}/en/karma-client/cars/not-an-id`);
  await expect(page.getByRole('alert')).toContainText('Truck not found in Karma.');
  expect(app.karma.requests).toHaveLength(reads);
});

test('lists Karma trucks through Gateway, preserves the route on Branch switching and supports reload/language', async ({
  page,
  app,
}) => {
  const headers: Record<string, string>[] = [];
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && request.postData()?.includes('AdminKarmaCars')) {
      headers.push(request.headers());
    }
  });
  await page.goto(`${app.url}/en/karma-client/cars`);
  await expect(page.getByRole('heading', { name: 'Trucks', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'KARMA TEST 41', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '000123456789012', exact: true })).toBeVisible();
  await chooseBranch(page, 'Sandbox');
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars`);
  expect(headers).toHaveLength(1);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  expect(headers).toHaveLength(2);
  await page.reload();
  await expect(page.getByRole('cell', { name: 'KARMA TEST 41', exact: true })).toBeVisible();
  await chooseLanguage(page, 'Български');
  await expect(page).toHaveURL(`${app.url}/bg/karma-client/cars`);
  await expect(page.getByRole('heading', { name: 'Камиони', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'KARMA TEST 41', exact: true })).toBeVisible();
  expect(
    headers.every(
      (value) =>
        !('x-branch-id' in value) && value['authorization'] === `Bearer ${app.demoSession.token}`,
    ),
  ).toBe(true);
});

test('shows empty/error states, preserves rows on refresh failure and recovers', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/karma-client/cars`);
  await expect(page.getByRole('cell', { name: 'KARMA TEST 41', exact: true })).toBeVisible();
  app.karma.setFailed(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Karma is unavailable. Try again.' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'KARMA TEST 41', exact: true })).toBeVisible();
  app.karma.setFailed(false);
  app.karma.setEmpty(true);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'No trucks available in Karma.', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test.describe('with Fleet disabled', () => {
  test.use({ fleetEnabled: false });
  test('keeps the independent Karma section available', async ({ page, app }) => {
    await page.goto(`${app.url}/en/karma-client/cars`);
    await expect(page.getByRole('cell', { name: 'KARMA TEST 41', exact: true })).toBeVisible();
    await expect(
      page.locator('aside').getByRole('link', { name: 'Vehicles', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator('aside').getByRole('link', { name: 'Trucks', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('signed out', () => {
  test.use({ demoSignedIn: false });
  test('shows login on the direct route and never reads Karma', async ({ page, app }) => {
    await page.goto(`${app.url}/en/karma-client/cars`);
    await expect(page.getByTestId('demo-login')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trucks', exact: true })).toHaveCount(0);
    expect(app.karma.requests).toEqual([]);
  });
});
