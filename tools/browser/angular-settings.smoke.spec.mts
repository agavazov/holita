import { expect, type Page } from '@playwright/test';
import { chooseBranch, test } from './angular-fixture.mjs';

interface SettingsApp {
  readonly gatewayUrl: string;
  readonly demoSession: { readonly token: string };
  readonly branchA: { readonly id: string };
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
async function graphql(
  page: Page,
  app: SettingsApp,
  query: string,
  variables = {},
  branch = app.branchA.id,
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
  const { branchA, branchB } = app;
  const path = `/en/${branchA.id}/fleet/settings/general`;
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
  await expect(page.getByRole('textbox', { name: /^Branch name/ })).toHaveValue(branchA.name);
  await page.getByRole('textbox', { name: /^Branch name/ }).fill('Browser Fleet');
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
  expect(await graphql(page, app, readSettings, { id: branchA.id })).toEqual({
    branch: { id: branchA.id, name: 'Browser Fleet' },
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
  await page.goto(app.url + `/en/${branchA.id}/fleet/vehicles/${vehicleId}/overview`);
  const odometer = page
    .locator('holita-kpi-tile')
    .filter({ has: page.getByText('Odometer', { exact: true }) });
  await expect(odometer.locator('.kpi-tile__value .app-num')).toHaveText('1,000');
  await expect(odometer.locator('.kpi-tile__unit')).toHaveText('mi');
  await expect(page.getByText('10 gal', { exact: true })).toBeVisible();
  await page.goto(app.url + path);
  await chooseBranch(page, branchB.name);
  await expect(page).toHaveURL(app.url + path.replace(branchA.id, branchB.id));
  await expect(page.getByRole('textbox', { name: /^Branch name/ })).toHaveValue(branchB.name);
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
  expect(await graphql(page, app, readSettings, { id: branchB.id }, branchB.id)).toMatchObject({
    branch: { id: branchB.id, name: branchB.name },
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
