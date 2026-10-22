import { expect, type Page } from '@playwright/test';
import { signOut, test } from './angular-fixture.mjs';

test.use({ demoSignedIn: false });
async function signIn(page: Page, name: string, branch: string) {
  await page.getByRole('combobox', { name: 'Tenant', exact: true }).click();
  await page.getByRole('option', { name, exact: true }).click();
  await expect(page.getByTestId('demo-login')).toBeDisabled();
  await page.getByRole('combobox', { name: 'Branch', exact: true }).click();
  await page.getByRole('option', { name: branch, exact: true }).click();
  await page.getByTestId('demo-login').click();
}
test('demo login gates deep links and Karma reads, survives reload, clears on logout and isolates a second tenant', async ({
  page,
  app,
}) => {
  const created = await page.request.post(app.gatewayUrl, {
    headers: { authorization: `Bearer ${app.demoSession.token}`, 'x-branch-id': app.branchA.id },
    data: {
      query: 'mutation { createFleetVehicle(input: { licensePlate: "FIRST-TENANT" }) { id } }',
    },
  });
  expect(await created.json()).toHaveProperty('data.createFleetVehicle.id');
  const business: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url() === app.gatewayUrl &&
      /Admin(Vehicles|Devices|Branches|FleetOverview|FleetPreferences|Karma)/.test(
        request.postData() ?? '',
      )
    ) {
      business.push(request.headers()['authorization'] ?? 'missing');
    }
  });
  for (const path of [
    'karma-client/cars',
    'karma-client/cars/41/location',
    `${app.branchB.id}/fleet/devices/new?search=old`,
  ]) {
    await page.goto(`${app.url}/en/${path}`);
    await expect(page.getByRole('heading', { name: 'Demo sign in', exact: true })).toBeVisible();
  }
  await expect(page.locator('holita-admin-shell')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Branch', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(business).toEqual([]);
  expect(app.karma.requests).toEqual([]);
  await signIn(page, app.demoSession.tenant.name, app.branchA.name);
  await expect(page).toHaveURL(`${app.url}/en/${app.branchA.id}/fleet/overview`);
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  expect(business.length).toBeGreaterThan(0);
  expect(
    business.every((header) =>
      header.startsWith(`Bearer holita-demo.${app.demoSession.tenant.id}.`),
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Vehicles', exact: true }).click();
  const firstTenantVehicle = page.getByRole('button', { name: 'Open FIRST-TENANT', exact: true });
  await expect(firstTenantVehicle).toBeVisible();
  await page.reload();
  await expect(firstTenantVehicle).toBeVisible();
  await signOut(page);
  await expect(page.getByRole('heading', { name: 'Demo sign in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('holita.admin.demo-session'))).toBeNull();
  await signIn(page, 'Isolation tenant', 'Isolation branch');
  await expect(
    page
      .locator('holita-admin-topbar')
      .getByRole('button', { name: 'Branch: Isolation branch', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  // The first tenant's cached Vehicles must not survive the session change.
  await page.getByRole('link', { name: 'Vehicles', exact: true }).click();
  await expect(page.getByText('No vehicles yet', { exact: true })).toBeVisible();
  await expect(firstTenantVehicle).toHaveCount(0);
  expect(business.at(-1)).toContain('Bearer holita-demo.01000000-0000-4000-8000-000000000002.');
});
