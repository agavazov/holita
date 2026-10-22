import { expect } from '@playwright/test';
import { chooseBranch, test } from './angular-fixture.mjs';
import { enterKarmaDateTime } from './karma-date-time.mjs';

test('opens Karma trucks, details, location and filtered eData through Gateway independently of Branch and recovers from a Karma outage', async ({
  page,
  app,
}) => {
  const karmaRequests: { operation: string; headers: Record<string, string> }[] = [];
  page.on('request', (request) => {
    const operation = /"operationName":"(AdminKarma\w+)"/.exec(request.postData() ?? '')?.[1];
    if (request.url() === app.gatewayUrl && operation) {
      karmaRequests.push({ operation, headers: request.headers() });
    }
  });
  const listReads = () =>
    karmaRequests.filter(({ operation }) => operation === 'AdminKarmaCars').length;
  await page.goto(`${app.url}/en/karma-client/cars`);
  await expect(page.getByRole('heading', { name: 'Trucks', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '000123456789012', exact: true })).toBeVisible();
  expect(listReads()).toBe(1);
  // Karma data does not depend on the Branch: switching neither navigates nor refetches.
  await chooseBranch(page, app.branchB.name);
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars`);
  expect(listReads()).toBe(1);
  app.karma.setFailed(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Karma is unavailable. Try again.' }),
  ).toBeVisible();
  app.karma.setFailed(false);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('link', { name: 'KARMA TEST 41', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41`);
  const summary = page.getByRole('region', { name: 'Truck summary', exact: true });
  await expect(summary).toContainText('Fixture project (12)');
  await expect(summary).toContainText('Europe/Sofia (8)');
  await page.getByRole('link', { name: 'Location', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41/location`);
  await page.locator('holita-location-page summary').click();
  // Upstream markup is shown as text, never rendered.
  await expect(
    page.locator('holita-location-page dd').filter({ hasText: '<b>Fixture plain text</b>' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'eData', exact: true }).click();
  const rows = page.locator('holita-edata-page section tbody tr');
  await expect(rows).toHaveCount(50);
  // The fixture filters on UTC message times, so shifted bounds would miss message 3000000001.
  await enterKarmaDateTime(page, 'From (UTC)', '2026-01-01', '00:00:00');
  await enterKarmaDateTime(page, 'To (UTC)', '2026-01-01', '00:00:00');
  await page.getByLabel('Parameter IDs', { exact: true }).fill('99999');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'View message 3000000001', exact: true }),
  ).toBeVisible();
  expect(karmaRequests.length).toBeGreaterThan(0);
  expect(
    karmaRequests.every(
      ({ headers }) =>
        !('x-branch-id' in headers) &&
        headers['authorization'] === `Bearer ${app.demoSession.token}`,
    ),
  ).toBe(true);
});
