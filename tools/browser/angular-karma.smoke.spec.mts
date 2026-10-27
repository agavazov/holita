import { expect } from '@playwright/test';
import { chooseBranch, test } from './angular-fixture.mjs';
import { enterKarmaDateTime } from './karma-date-time.mjs';

test.use({ demoSignedIn: false });

test('opens Karma trucks, details, location and filtered eData through Gateway independently of Branch and recovers from a Karma outage', async ({
  page,
  app,
}) => {
  const settingsUrl = `${app.url}/en/karma-client/cars/41/configuration`;
  await page.goto(settingsUrl);
  await expect(page.getByRole('heading', { name: 'Demo sign in', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Tenant', exact: true }).click();
  await page.getByRole('option', { name: app.demoSession.tenant.name, exact: true }).click();
  await expect(page.getByTestId('demo-login')).toBeDisabled();
  await page.getByRole('combobox', { name: 'Branch', exact: true }).click();
  await page.getByRole('option', { name: app.branchA.name, exact: true }).click();
  await page.getByTestId('demo-login').click();
  await expect(page).toHaveURL(settingsUrl);
  await expect(page.getByRole('heading', { name: 'Device settings', exact: true })).toBeVisible();
  await expect(
    page.locator('holita-admin-topbar').getByRole('button', {
      name: `Branch: ${app.branchA.name}`,
      exact: true,
    }),
  ).toBeVisible();

  const karmaRequests: { operation: string; headers: Record<string, string> }[] = [];
  page.on('request', (request) => {
    const operation = /"operationName":"(AdminKarma(?:Cars|Car|Location|Edata|References))"/.exec(
      request.postData() ?? '',
    )?.[1];
    if (request.url() === app.gatewayUrl && operation) {
      karmaRequests.push({ operation, headers: request.headers() });
    }
  });
  const listReads = () =>
    karmaRequests.filter(({ operation }) => operation === 'AdminKarmaCars').length;
  await page.goto(`${app.url}/en/karma-client/cars`);
  await expect(page.getByRole('heading', { name: 'Trucks', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'KARMA TEST 41', exact: true })).toBeVisible();
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
  await expect(summary).toContainText('Fixture project');
  await expect(summary).toContainText('Europe/Sofia');
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
  // Cross the desktop breakpoint while the navigation mask is still fading out.
  // Stretch only that animation so the regression does not depend on machine speed.
  await page.addStyleTag({
    content: '.p-drawer-mask.p-overlay-mask-leave-active { animation-duration: 2s; }',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  const drawer = page.locator('.app-nav-drawer');
  await drawer.getByRole('link', { name: 'Trucks', exact: true }).click();
  await expect(page.locator('.p-drawer-mask.p-overlay-mask-leave-active')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('#desktop-navigation')).toBeVisible();
  await expect(page.locator('.p-drawer-mask')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/p-overflow-hidden/);
  await page.getByRole('link', { name: 'KARMA TEST 41', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41`);
  expect(karmaRequests.length).toBeGreaterThan(0);
  expect(
    karmaRequests.every(
      ({ headers }) =>
        !('x-branch-id' in headers) &&
        headers['authorization']?.startsWith(`Bearer holita-demo.${app.demoSession.tenant.id}.`),
    ),
  ).toBe(true);

  await page.getByRole('link', { name: 'Device settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Device settings', exact: true })).toBeVisible();
  await chooseBranch(page, app.branchA.name);
  await expect(page).toHaveURL(settingsUrl);
  const settings = page.locator('holita-device-management-page');
  await expect(settings).toContainText('000123456789012');
  await expect(page.getByRole('button', { name: 'Link device', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Manage device link', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Fleet', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Registered device', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Add parameter', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Read configuration', exact: true })).toBeEnabled();

  // Legacy query hints cannot replace the active Branch or the truck's Karma device.
  await page.goto(
    `${settingsUrl}?branchId=${app.branchB.id}&deviceId=00000000-0000-4000-8000-000000000042`,
  );
  await expect(settings).toContainText('000123456789012');
  await expect(
    page.locator('holita-admin-topbar').getByRole('button', {
      name: `Branch: ${app.branchA.name}`,
      exact: true,
    }),
  ).toBeVisible();
  const acceptedRead = page.waitForResponse(
    (response) =>
      response
        .request()
        .postData()
        ?.includes('"operationName":"AdminRequestDeviceConfigurationRead"') === true,
  );
  await page.getByRole('button', { name: 'Read configuration', exact: true }).click();
  const read = await acceptedRead;
  expect(read.request().headers()['x-branch-id']).toBe(app.branchA.id);
  const submitted: unknown = read.request().postDataJSON();
  expect(submitted).toHaveProperty('variables', {
    input: {
      karmaCarId: '41',
      expectedKarmaDeviceId: '000123456789012',
    },
  });
  expect(await read.json()).toMatchObject({
    data: {
      requestFleetDeviceConfigurationRead: {
        branchId: app.branchA.id,
        karmaCarId: '41',
        karmaDeviceId: '000123456789012',
        kind: 'READ_CONFIGURATION',
      },
    },
  });
  await page.reload();
  await expect(
    page.getByRole('status').getByText('Read configuration', { exact: true }),
  ).toBeVisible();
  await expect(settings).toContainText('000123456789012');
  await expect(page.getByRole('combobox', { name: 'Registered device', exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Read configuration', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Read parameters', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Read rules', exact: true })).toBeDisabled();
});
