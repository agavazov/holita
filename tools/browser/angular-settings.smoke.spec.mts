import { expect, type Page } from '@playwright/test';
import { chooseBranch, test } from './angular-fixture.mjs';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const path = `/en/${branchA}/fleet/settings/general`;
interface SettingsApp {
  readonly gatewayUrl: string;
  readonly demoSession: { readonly token: string };
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
async function graphql(
  page: Page,
  app: SettingsApp,
  query: string,
  variables = {},
  branch = branchA,
) {
  const response = await page.request.post(app.gatewayUrl, {
    headers: { authorization: `Bearer ${app.demoSession.token}`, 'x-branch-id': branch },
    data: { query, variables },
  });
  const body: unknown = await response.json();
  if (!object(body)) {
    throw new Error('Missing settings GraphQL result.');
  }
  expect(body['errors']).toBeUndefined();
  if (!object(body['data'])) {
    throw new Error('Missing settings GraphQL data.');
  }
  return body['data'];
}
async function select(page: Page, label: string, choice: string) {
  const field = page.getByRole('combobox', { name: label, exact: true });
  await field.click();
  const id = await field.getAttribute('aria-controls');
  if (!id) {
    throw new Error('Missing settings choice list.');
  }
  await page.locator(`[id="${id}"]`).getByRole('option', { name: choice, exact: true }).click();
  await expect(field).toHaveAttribute('aria-expanded', 'false');
}
const readSettings = `query BrowserSettings($id:ID!) {
  branch(id:$id) { id name }
  fleetSettings { timeZone distanceUnit volumeUnit lowFuelPct notReportingHours speedLimitKph }
  fleetDataClock { timeZone }
}`;

test('persists General settings and the Core Branch name, applies display units and keeps Branch scopes separate', async ({
  page,
  app,
}) => {
  const created = await graphql(
    page,
    app,
    'mutation { createFleetVehicle(input:{licensePlate:"SETTINGS-01",fuelTankCapacityL:38}) { id } }',
  );
  const vehicle = created['createFleetVehicle'];
  if (!object(vehicle) || typeof vehicle['id'] !== 'string') {
    throw new Error('Missing settings test vehicle.');
  }
  const vehicleId = vehicle['id'];
  await graphql(
    page,
    app,
    'mutation($input:RecordFleetOdometerReadingInput!){recordFleetOdometerReading(input:$input){id}}',
    { input: { vehicleId, odometerKm: 1609.3, recordedAt: new Date().toISOString() } },
  );
  await page.goto(app.url + path);
  await expect(page.getByRole('heading', { name: 'General', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Branch name/ })).toHaveValue('Discordia');
  await expect(
    page.getByText(
      'Notification delivery is not connected. These options are unavailable and are not saved.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(3);
  for (const control of await page.getByRole('switch').all()) {
    await expect(control).toBeDisabled();
  }
  await page.getByRole('textbox', { name: /^Branch name/ }).fill('Browser Fleet');
  await chooseBranch(page, 'Sandbox');
  const discard = page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true });
  await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page).toHaveURL(app.url + path);
  await expect(page.getByRole('textbox', { name: /^Branch name/ })).toHaveValue('Browser Fleet');
  await select(page, 'Time zone', 'Europe/Belgrade');
  await select(page, 'Distance', 'Miles');
  await select(page, 'Volume', 'US gallons');
  await page.getByRole('spinbutton', { name: /^Low fuel below/ }).fill('20');
  await page.getByRole('spinbutton', { name: /^Not reporting after/ }).fill('24');
  await page.getByRole('spinbutton', { name: /^Truck speed limit/ }).fill('100');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Settings saved.', { exact: true })).toBeVisible();
  await expect(
    page
      .locator('holita-admin-topbar')
      .getByRole('button', { name: 'Branch: Browser Fleet', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: /^Branch name/ })).toHaveValue('Browser Fleet');
  await expect(page.getByRole('combobox', { name: 'Distance', exact: true })).toContainText(
    'Miles',
  );
  await expect(page.getByRole('spinbutton', { name: /^Low fuel below/ })).toHaveValue('20');
  expect(await graphql(page, app, readSettings, { id: branchA })).toEqual({
    branch: { id: branchA, name: 'Browser Fleet' },
    fleetSettings: {
      timeZone: 'Europe/Belgrade',
      distanceUnit: 'MI',
      volumeUnit: 'US_GALLON',
      lowFuelPct: 20,
      notReportingHours: 24,
      speedLimitKph: 100,
    },
    fleetDataClock: { timeZone: 'Europe/Belgrade' },
  });
  await page.goto(app.url + `/en/${branchA}/fleet/vehicles/${vehicleId}/overview`);
  const odometer = page
    .locator('holita-kpi-tile')
    .filter({ has: page.getByText('Odometer', { exact: true }) });
  await expect(odometer.locator('.kpi-tile__value .app-num')).toHaveText('1,000');
  await expect(odometer.locator('.kpi-tile__unit')).toHaveText('mi');
  await expect(page.getByText('10 gal', { exact: true })).toBeVisible();
  await page.goto(app.url + path);
  await chooseBranch(page, 'Sandbox');
  await expect(page).toHaveURL(app.url + path.replace(branchA, branchB));
  await expect(page.getByRole('textbox', { name: /^Branch name/ })).toHaveValue('Sandbox');
  await expect(page.getByRole('combobox', { name: 'Distance', exact: true })).toContainText(
    'Kilometres',
  );
  await expect(page.getByRole('spinbutton', { name: /^Low fuel below/ })).toHaveValue('12');
  await page.getByRole('spinbutton', { name: /^Low fuel below/ }).fill('25');
  await page.getByRole('spinbutton', { name: /^Low fuel below/ }).press('Tab');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Settings saved.', { exact: true })).toBeVisible();
  await chooseBranch(page, 'Browser Fleet');
  await expect(page).toHaveURL(app.url + path);
  await expect(page.getByRole('spinbutton', { name: /^Low fuel below/ })).toHaveValue('20');
  expect(await graphql(page, app, readSettings, { id: branchB }, branchB)).toMatchObject({
    branch: { id: branchB, name: 'Sandbox' },
    fleetSettings: {
      timeZone: 'Europe/Sofia',
      distanceUnit: 'KM',
      volumeUnit: 'LITRE',
      lowFuelPct: 25,
      notReportingHours: 48,
      speedLimitKph: 90,
    },
  });
});

test('reports a partial cross-service settings save, preserves the name draft and retries it', async ({
  page,
  app,
}) => {
  let failRename = true;
  await page.route(app.gatewayUrl, async (route) => {
    const body: unknown = route.request().postDataJSON();
    if (failRename && object(body) && body['operationName'] === 'AdminUpdateBranchName') {
      failRename = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unavailable' }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto(app.url + path);
  const name = page.getByRole('textbox', { name: /^Branch name/ });
  await expect(name).toHaveValue('Discordia');
  await name.fill('Retained Fleet');
  await page.getByRole('spinbutton', { name: /^Low fuel below/ }).fill('35');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page
      .locator('holita-general-settings-view p-message')
      .getByText(/Fleet settings were saved, but the Branch name was not saved\./),
  ).toBeVisible();
  await expect(name).toHaveValue('Retained Fleet');
  await expect(page.getByText('Settings saved.', { exact: true })).toHaveCount(0);
  expect(await graphql(page, app, readSettings, { id: branchA })).toMatchObject({
    branch: { id: branchA, name: 'Discordia' },
    fleetSettings: { lowFuelPct: 35 },
  });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Settings saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(name).toHaveValue('Retained Fleet');
  await expect(page.getByRole('spinbutton', { name: /^Low fuel below/ })).toHaveValue('35');
  expect(await graphql(page, app, readSettings, { id: branchA })).toMatchObject({
    branch: { id: branchA, name: 'Retained Fleet' },
    fleetSettings: { lowFuelPct: 35 },
  });
});
