import { expect, type Page } from '@playwright/test';
import { signOut, test } from './angular-fixture.mjs';

test.use({ signedIn: false });
async function signIn(
  page: Page,
  account: { readonly email: string; readonly password: string },
  branch?: string,
) {
  await page.getByRole('textbox', { name: /^Email/ }).fill(account.email);
  await page.getByRole('textbox', { name: /^Password/ }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  if (branch) {
    await page.getByRole('combobox', { name: 'Choose a fleet', exact: true }).click();
    await page.getByRole('option', { name: branch, exact: true }).click();
    await page.getByRole('button', { name: 'Open Dashboard', exact: true }).click();
  }
}
test('sign-in gates deep links and business reads, survives reload, clears on logout and isolates a second tenant', async ({
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
      /Admin(Vehicles|Devices|Branches|FleetOverview|FleetPreferences)/.test(
        request.postData() ?? '',
      )
    ) {
      business.push(request.headers()['authorization'] ?? 'missing');
    }
  });
  await page.goto(`${app.url}/en/${app.branchB.id}/fleet/devices/new?search=old`);
  await expect(page).toHaveURL(`${app.url}/en/${app.branchB.id}/fleet/devices/new?search=old`);
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.locator('holita-admin-shell')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Choose a fleet', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /^Email/ })).toBeVisible();
  expect(business).toEqual([]);
  await signIn(page, app.account);
  await expect(page.getByRole('heading', { name: 'Choose a fleet', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('holita.admin.session') !== null)).toBe(
    true,
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Choose a fleet', exact: true })).toBeVisible();
  const sibling = await page.context().newPage();
  await sibling.goto(`${app.url}/en/sign-in`);
  await expect(sibling.getByRole('heading', { name: 'Choose a fleet', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Choose a fleet', exact: true }).click();
  await page.getByRole('option', { name: app.branchA.name, exact: true }).click();
  await page.getByRole('button', { name: 'Open Dashboard', exact: true }).click();
  await expect(page).toHaveURL(
    `${app.url}/en/${app.branchA.id}/fleet/dashboard/overview?search=old`,
  );
  await expect(page.getByRole('heading', { name: app.branchA.name, exact: true })).toBeVisible();
  expect(business.length).toBeGreaterThan(0);
  expect(business.every((header) => header.startsWith('Bearer holita-session.'))).toBe(true);
  await page.getByRole('link', { name: 'Vehicles', exact: true }).click();
  const firstTenantVehicle = page.getByRole('button', { name: 'Open FIRST-TENANT', exact: true });
  await expect(firstTenantVehicle).toBeVisible();
  await page.reload();
  await expect(firstTenantVehicle).toBeVisible();
  await sibling.goto(`${app.url}/en/${app.branchA.id}/fleet/vehicles`);
  await expect(
    sibling.getByRole('button', { name: 'Open FIRST-TENANT', exact: true }),
  ).toBeVisible();
  await signOut(page);
  await expect(sibling.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await sibling.close();
  expect(await page.evaluate(() => localStorage.getItem('holita.admin.session'))).toBeNull();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('holita.admin.session'))).toBeNull();
  const isolationAccount = await app.createAccount('01000000-0000-4000-8000-000000000002');
  await signIn(page, isolationAccount);
  await expect(
    page
      .locator('holita-admin-topbar')
      .getByRole('button', { name: 'Branch: Isolation branch', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Isolation branch', exact: true })).toBeVisible();
  // The first tenant's cached Vehicles must not survive the session change.
  await page.getByRole('link', { name: 'Vehicles', exact: true }).click();
  await expect(page.getByText('No vehicles yet', { exact: true })).toBeVisible();
  await expect(firstTenantVehicle).toHaveCount(0);
  const restored: unknown = await page.evaluate(() => {
    const session: unknown = JSON.parse(localStorage.getItem('holita.admin.session') ?? 'null');
    return session;
  });
  expect(restored).toHaveProperty('tenant.id', '01000000-0000-4000-8000-000000000002');
  expect(business.at(-1)).toMatch(/^Bearer holita-session\./);
});
