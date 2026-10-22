import { expect, type Page } from '@playwright/test';
import { chooseBranch, chooseMenuItem, test } from './angular-fixture.mjs';

interface VehiclesApp {
  readonly gatewayUrl: string;
  readonly demoSession: { readonly token: string };
  readonly branchA: { readonly id: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function graphql(
  page: Page,
  app: VehiclesApp,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await page.request.post(app.gatewayUrl, {
    headers: {
      authorization: `Bearer ${app.demoSession.token}`,
      'x-branch-id': app.branchA.id,
      'accept-language': 'en',
    },
    data: { query, variables },
  });
  expect(response.ok()).toBe(true);
  const body: unknown = await response.json();
  if (!isRecord(body) || body['errors'] !== undefined || !isRecord(body['data'])) {
    throw new Error(`Unexpected GraphQL result: ${JSON.stringify(body)}`);
  }
  return body['data'];
}

async function selectOption(page: Page, field: string, value: string): Promise<void> {
  const combobox = page.getByRole('combobox', { name: field, exact: true });
  await combobox.click();
  await expect(combobox).toHaveAttribute('aria-expanded', 'true');
  const listboxId = await combobox.getAttribute('aria-controls');
  if (!listboxId) {
    throw new Error(`Missing controlled listbox for ${field}.`);
  }
  const listbox = page.getByRole('listbox').and(page.locator(`[id="${listboxId}"]`));
  await listbox.getByRole('option', { name: value, exact: true }).click();
  await expect(combobox).toHaveAttribute('aria-expanded', 'false');
  await expect(listbox).toBeHidden();
}

test.describe('Vehicles', () => {
  test('persists the rich drawer, clears optional fields, isolates A → B → A and confirms deletion', async ({
    page,
    app,
  }) => {
    const path = `/en/${app.branchA.id}/fleet/vehicles`;
    expect(
      await graphql(
        page,
        app,
        'mutation VehicleOptions { group: createFleetVehicleGroup(input: { name: "International", colorToken: C1 }) { id } driver: createFleetDriver(input: { firstName: "Ivan", lastName: "Ivanov" }) { id } }',
      ),
    ).toEqual({ group: { id: expect.any(String) }, driver: { id: expect.any(String) } });
    await page.goto(app.url + path + '?search=CA1234');
    await page
      .locator('holita-page-header')
      .getByRole('button', { name: 'New vehicle', exact: true })
      .click();
    const create = page.getByRole('dialog', { name: 'New vehicle', exact: true });
    await expect(page).toHaveURL(app.url + path + '/new?search=CA1234');
    await create.getByRole('textbox', { name: /^License plate/ }).fill(' CA1234AB ');
    await create.getByRole('textbox', { name: 'Fleet number', exact: true }).fill(' T-04 ');
    await create.getByRole('textbox', { name: 'VIN', exact: true }).fill('wdb9634031l123456');
    await create.getByRole('textbox', { name: 'Make', exact: true }).fill(' Mercedes-Benz ');
    await create.getByRole('textbox', { name: 'Model', exact: true }).fill(' Actros ');
    await create.getByRole('spinbutton', { name: 'Year', exact: true }).fill('2024');
    await create.getByRole('spinbutton', { name: 'Fuel tank, L', exact: true }).fill('600');
    await selectOption(page, 'Type', 'Tractor unit');
    await selectOption(page, 'Fuel', 'Diesel');
    await selectOption(page, 'Status', 'In service');
    await selectOption(page, 'Group', 'International');
    await selectOption(page, 'Driver', 'Ivan Ivanov');
    await create
      .getByRole('textbox', { name: 'Notes', exact: true })
      .fill('First line\nSecond line');
    await create.getByRole('button', { name: 'Create vehicle', exact: true }).click();
    await expect(create).toBeHidden();
    await expect(page).toHaveURL(app.url + path + '?search=CA1234');
    await page.getByRole('button', { name: 'Actions for CA1234AB', exact: true }).click();
    await chooseMenuItem(page, 'Edit');
    const edit = page.getByRole('dialog', { name: 'Edit CA1234AB', exact: true });
    await expect(page).toHaveURL(/\/[^/]+\/edit\?search=CA1234$/);
    const vehicleId = new URL(page.url()).pathname.split('/').at(-2) ?? '';
    expect(vehicleId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(edit.getByRole('textbox', { name: 'Fleet number', exact: true })).toHaveValue(
      'T-04',
    );
    await expect(edit.getByRole('textbox', { name: 'VIN', exact: true })).toHaveValue(
      'WDB9634031L123456',
    );
    await expect(edit.getByRole('textbox', { name: 'Make', exact: true })).toHaveValue(
      'Mercedes-Benz',
    );
    await expect(edit.getByRole('textbox', { name: 'Model', exact: true })).toHaveValue('Actros');
    await expect(edit.getByRole('spinbutton', { name: 'Year', exact: true })).toHaveValue('2024');
    await expect(edit.getByRole('spinbutton', { name: 'Fuel tank, L', exact: true })).toHaveValue(
      '600',
    );
    await expect(edit.getByRole('combobox', { name: 'Type', exact: true })).toHaveText(
      'Tractor unit',
    );
    await expect(edit.getByRole('combobox', { name: 'Fuel', exact: true })).toHaveText('Diesel');
    await expect(edit.getByRole('combobox', { name: 'Status', exact: true })).toHaveText(
      'In service',
    );
    await expect(edit.getByRole('combobox', { name: 'Group', exact: true })).toHaveText(
      'International',
    );
    await expect(edit.getByRole('combobox', { name: 'Driver', exact: true })).toHaveText(
      'Ivan Ivanov',
    );
    await expect(edit.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(
      'First line\nSecond line',
    );
    await edit.getByRole('textbox', { name: 'Notes', exact: true }).fill('');
    await edit.getByRole('spinbutton', { name: 'Year', exact: true }).fill('');
    await edit.getByRole('spinbutton', { name: 'Fuel tank, L', exact: true }).fill('');
    await selectOption(page, 'Type', 'None');
    await selectOption(page, 'Fuel', 'None');
    await selectOption(page, 'Group', 'None');
    await selectOption(page, 'Driver', 'None');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(edit).toBeHidden();
    await page.reload();
    await page.getByRole('button', { name: 'Actions for CA1234AB', exact: true }).click();
    await chooseMenuItem(page, 'Edit');
    await expect(edit.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('');
    await expect(edit.getByRole('spinbutton', { name: 'Year', exact: true })).toHaveValue('');
    await expect(edit.getByRole('spinbutton', { name: 'Fuel tank, L', exact: true })).toHaveValue(
      '',
    );
    await expect(edit.getByRole('combobox', { name: 'Type', exact: true })).toHaveText('None');
    await expect(edit.getByRole('combobox', { name: 'Fuel', exact: true })).toHaveText('None');
    await expect(edit.getByRole('combobox', { name: 'Group', exact: true })).toHaveText('None');
    await expect(edit.getByRole('combobox', { name: 'Driver', exact: true })).toHaveText('None');
    await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(edit).toBeHidden();
    await chooseBranch(page, app.branchB.name);
    await expect(page).toHaveURL(/\/fleet\/vehicles$/);
    await expect(page.getByRole('button', { name: 'Open CA1234AB', exact: true })).toHaveCount(0);
    await page.goto(`${app.url}/en/${app.branchB.id}/fleet/vehicles/${vehicleId}/overview`);
    await expect(page.getByText('Vehicle not found', { exact: true })).toBeVisible();
    await page.goto(app.url + path);
    await page.getByRole('button', { name: 'Actions for CA1234AB', exact: true }).click();
    await chooseMenuItem(page, 'Delete');
    const confirmation = page.getByRole('alertdialog', { name: 'Delete vehicles?', exact: true });
    await expect(confirmation.getByRole('listitem')).toHaveText('CA1234AB');
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Vehicles deleted: 1.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Open CA1234AB', exact: true })).toHaveCount(0);
  });

  test('keeps filter and sorting in the URL, deactivates the selection and reports a partial deletion of a protected vehicle', async ({
    page,
    app,
  }) => {
    const created = await graphql(
      page,
      app,
      `
        mutation SortVehicles {
          a: createFleetVehicle(
            input: { licensePlate: "SORT-A", fleetNumber: "T-01", make: "Volvo" }
          ) {
            id
          }
          b: createFleetVehicle(
            input: { licensePlate: "SORT-B", fleetNumber: "T-02", make: "Scania" }
          ) {
            id
          }
          c: createFleetVehicle(
            input: { licensePlate: "SORT-C", fleetNumber: "T-03", make: "Volvo" }
          ) {
            id
          }
        }
      `,
    );
    const protectedVehicle = created['c'];
    if (!isRecord(protectedVehicle) || typeof protectedVehicle['id'] !== 'string') {
      throw new Error('Missing SORT-C.');
    }
    // An installed device makes SORT-C undeletable.
    await graphql(
      page,
      app,
      'mutation ProtectedVehicle($input: CreateFleetDeviceInput!) { createFleetDevice(input: $input) { id } }',
      { input: { imei: '000123456789012', vehicleId: protectedVehicle['id'] } },
    );
    await page.goto(`${app.url}/en/${app.branchA.id}/fleet/vehicles`);
    await page.getByRole('searchbox').fill('SORT');
    await expect(page).toHaveURL(/search=SORT/);
    await page.getByRole('button', { name: 'Add filter', exact: true }).click();
    const filter = page.getByRole('dialog', { name: 'Filter condition', exact: true });
    await filter.getByRole('combobox', { name: 'Column', exact: true }).click();
    await page.getByRole('option', { name: 'Make', exact: true }).click();
    await filter.getByRole('textbox', { name: 'Value', exact: true }).fill('Volvo');
    await filter.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open SORT-A', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open SORT-B', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open SORT-C', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Sort:/ }).click();
    await chooseMenuItem(page, 'Fleet number');
    await page.getByRole('button', { name: /^Sort:/ }).click();
    await chooseMenuItem(page, 'Descending');
    await expect.poll(() => new URL(page.url()).searchParams.get('sort')).toBe('fleetNumber');
    await expect.poll(() => new URL(page.url()).searchParams.get('order')).toBe('desc');
    const ordered = page.getByRole('button', { name: /^Open SORT-/ });
    await expect(ordered).toHaveText(['SORT-C', 'SORT-A']);
    const filteredUrl = page.url();
    await page.reload();
    await expect(page).toHaveURL(filteredUrl);
    await expect(page.getByRole('searchbox')).toHaveValue('SORT');
    await expect(ordered).toHaveText(['SORT-C', 'SORT-A']);
    await page.getByRole('checkbox', { name: 'Select SORT-A', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Select SORT-C', exact: true }).check();
    const bulk = page.getByRole('region', { name: 'Actions for selected records', exact: true });
    await bulk.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await expect(page.getByText('Vehicles deactivated: 2.', { exact: true })).toBeVisible();
    await expect(bulk).toBeHidden();
    await page.reload();
    for (const plate of ['SORT-A', 'SORT-C']) {
      const row = page
        .getByRole('row')
        .filter({ has: page.getByRole('button', { name: `Open ${plate}`, exact: true }) });
      await expect(row.getByText('Inactive', { exact: true }), plate).toBeVisible();
    }
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open SORT-B', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Open SORT-B', exact: true })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Select SORT-A', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Select SORT-C', exact: true }).check();
    await bulk.getByRole('button', { name: 'Delete', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Delete vehicles?', exact: true });
    await expect(confirmation.getByRole('listitem')).toHaveCount(2);
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(/Vehicles deleted: 1\./)).toBeVisible();
    await expect(page.getByText(/SORT-C:.*devices or history/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open SORT-A', exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Select SORT-C', exact: true })).toBeChecked();
  });
});
