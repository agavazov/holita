import { expect } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';

test('lists Karma trucks through Gateway, preserves the route on Store switching and supports reload/language', async ({
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
  await chooseStore(page, 'Sandbox');
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
        !('x-store-id' in value) && value['authorization'] === `Bearer ${app.demoSession.token}`,
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
  await expect(page.getByRole('alert')).toContainText('Karma is unavailable. Try again.');
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
