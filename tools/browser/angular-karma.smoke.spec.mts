import { expect } from '@playwright/test';
import { join } from 'node:path';
import { workspaceRoot } from '../graphql/contracts.mjs';
import { chooseBranch, test } from './angular-fixture.mjs';

test('opens truck details from the list, preserves scope through Branch/language changes and returns to the list', async ({
  page,
  app,
}) => {
  const headers: Record<string, string>[] = [];
  page.on('request', (request) => {
    if (
      request.url() === app.gatewayUrl &&
      request.postData()?.includes('"operationName":"AdminKarmaCar"')
    )
      headers.push(request.headers());
  });
  await page.goto(`${app.url}/en/karma-client/cars`);
  await page.getByRole('link', { name: 'KARMA TEST 41', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41`);
  await expect(page.getByRole('heading', { name: 'Truck details', exact: true })).toBeVisible();
  await expect(page.locator('dl')).toContainText('000123456789012');
  await expect(page.locator('dl')).toContainText('Trailer');
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of ['light', 'dark']) {
      await expect(page.locator('dl')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: join(
          workspaceRoot,
          '.references/review',
          `karma-details-${viewport.name}-${theme}.png`,
        ),
        fullPage: true,
        animations: 'disabled',
      });
      await page
        .getByRole('button', {
          name: theme === 'light' ? 'Use dark theme' : 'Use light theme',
          exact: true,
        })
        .click();
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await chooseBranch(page, 'Sandbox');
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41`);
  expect(headers).toHaveLength(1);
  await page.reload();
  await expect(page.locator('dl')).toContainText('KARMA TEST 41');
  await page.getByRole('link', { name: 'Български', exact: true }).click();
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
  await expect(page.locator('dl')).toContainText('KARMA TEST 41');
  app.karma.setFailed(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Karma is unavailable. Try again.' }),
  ).toBeVisible();
  await expect(page.locator('dl')).toContainText('KARMA TEST 41');
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
    if (request.url() === app.gatewayUrl && request.postData()?.includes('AdminKarmaCars'))
      headers.push(request.headers());
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
  await page.getByRole('link', { name: 'Български', exact: true }).click();
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
