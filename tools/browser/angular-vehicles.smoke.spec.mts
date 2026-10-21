import { expect, type Page } from '@playwright/test';
import {
  chooseBranch,
  chooseLanguage,
  chooseMenuItem,
  setDarkTheme,
  test,
} from './angular-fixture.mjs';

const branchA = '10000000-0000-4000-8000-000000000001';
const path = `/en/${branchA}/fleet/vehicles`;

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

async function createVehicle(
  page: Page,
  plate: string,
  fleetNumber: string,
  make: string,
): Promise<void> {
  await page
    .locator('holita-page-header')
    .getByRole('button', { name: 'New vehicle', exact: true })
    .click();
  const drawer = page.getByRole('dialog', { name: 'New vehicle', exact: true });
  await drawer.getByRole('textbox', { name: /^License plate/ }).fill(plate);
  await drawer.getByRole('textbox', { name: 'Fleet number', exact: true }).fill(fleetNumber);
  await drawer.getByRole('textbox', { name: 'Make', exact: true }).fill(make);
  await drawer.getByRole('button', { name: 'Create vehicle', exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('button', { name: `Open ${plate}`, exact: true })).toBeVisible();
}

test.describe('Vehicles', () => {
  test('persists the rich drawer, clears optional fields, isolates A → B → A and confirms deletion', async ({
    page,
    app,
  }) => {
    const options = await page.request.post(app.gatewayUrl, {
      headers: {
        authorization: `Bearer ${app.demoSession.token}`,
        'x-branch-id': branchA,
        'accept-language': 'en',
      },
      data: {
        query:
          'mutation VehicleOptions { group: createFleetVehicleGroup(input: { name: "International", colorToken: C1 }) { id } driver: createFleetDriver(input: { firstName: "Ivan", lastName: "Ivanov" }) { id } }',
      },
    });
    expect(options.ok()).toBe(true);
    const optionBody: unknown = await options.json();
    expect(optionBody).toEqual({
      data: { group: { id: expect.any(String) }, driver: { id: expect.any(String) } },
    });
    await page.goto(app.url + path + '?search=CA1234');
    await page
      .locator('holita-page-header')
      .getByRole('button', { name: 'New vehicle', exact: true })
      .click();
    const create = page.getByRole('dialog', { name: 'New vehicle', exact: true });
    await expect(page).toHaveURL(app.url + path + '/new?search=CA1234');
    await create.getByRole('button', { name: 'Create vehicle', exact: true }).click();
    await expect(create.getByRole('textbox', { name: /^License plate/ })).toBeFocused();
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
    await edit.getByRole('textbox', { name: 'Notes', exact: true }).fill('Unsaved draft');
    await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
    const unsaved = page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true });
    await unsaved.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(edit.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(
      'Unsaved draft',
    );
    await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
    await unsaved.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(edit).toBeHidden();
    await chooseBranch(page, 'Sandbox');
    await expect(page).toHaveURL(/\/fleet\/vehicles$/);
    await expect(page.getByRole('button', { name: 'Open CA1234AB', exact: true })).toHaveCount(0);
    await chooseBranch(page, 'Discordia');
    const actions = page.getByRole('button', { name: 'Actions for CA1234AB', exact: true });
    await actions.click();
    await expect(page.getByRole('menuitem', { name: 'Open profile', exact: true })).toBeVisible();
    await chooseMenuItem(page, 'Delete');
    const confirmation = page.getByRole('alertdialog', { name: 'Delete vehicles?', exact: true });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole('listitem')).toHaveText('CA1234AB');
    await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(actions).toBeFocused();
    await actions.click();
    await chooseMenuItem(page, 'Delete');
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Vehicles deleted: 1.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Open CA1234AB', exact: true })).toHaveCount(0);
  });

  test('keeps filter and sorting in the URL and deactivates the selected real records', async ({
    page,
    app,
  }) => {
    await page.goto(app.url + path);
    await createVehicle(page, 'SORT-A', 'T-01', 'Volvo');
    await createVehicle(page, 'SORT-B', 'T-02', 'Scania');
    await createVehicle(page, 'SORT-C', 'T-03', 'Volvo');
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
      await expect(row.getByText('Inactive', { exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open SORT-B', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Open SORT-B', exact: true })).toHaveCount(0);
  });

  test('keeps a protected vehicle selected after a partial bulk deletion and allows retry', async ({
    page,
    app,
  }) => {
    await page.goto(app.url + path);
    await createVehicle(page, 'DELETE-A', 'D-01', 'Volvo');
    await createVehicle(page, 'DELETE-B', 'D-02', 'Scania');
    await page.getByRole('button', { name: 'Actions for DELETE-B', exact: true }).click();
    await chooseMenuItem(page, 'Edit');
    const vehicleId = new URL(page.url()).pathname.split('/').at(-2);
    expect(vehicleId).toMatch(/^[0-9a-f-]{36}$/);
    await page
      .getByRole('dialog', { name: 'Edit DELETE-B', exact: true })
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const response = await page.request.post(app.gatewayUrl, {
      headers: {
        authorization: `Bearer ${app.demoSession.token}`,
        'x-branch-id': branchA,
        'accept-language': 'en',
      },
      data: {
        query:
          'mutation ProtectedVehicle($input: CreateFleetDeviceInput!) { createFleetDevice(input: $input) { id } }',
        variables: { input: { imei: '000123456789012', vehicleId } },
      },
    });
    expect(response.ok()).toBe(true);
    const body: unknown = await response.json();
    expect(body).toEqual({ data: { createFleetDevice: { id: expect.any(String) } } });
    await page.reload();
    await page.getByRole('checkbox', { name: 'Select DELETE-A', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Select DELETE-B', exact: true }).check();
    const bulk = page.getByRole('region', { name: 'Actions for selected records', exact: true });
    await bulk.getByRole('button', { name: 'Delete', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Delete vehicles?', exact: true });
    await expect(confirmation.getByRole('listitem')).toHaveCount(2);
    expect(await confirmation.getByRole('listitem').allTextContents()).toEqual(
      expect.arrayContaining(['DELETE-A', 'DELETE-B']),
    );
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(/Vehicles deleted: 1\./)).toBeVisible();
    await expect(page.getByText(/DELETE-B:.*devices or history/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open DELETE-A', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open DELETE-B', exact: true })).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Select DELETE-B', exact: true }),
    ).toBeChecked();
    await bulk.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirmation.getByRole('listitem')).toHaveText('DELETE-B');
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirmation).toBeHidden();
    await expect(
      page.getByRole('checkbox', { name: 'Select DELETE-B', exact: true }),
    ).toBeChecked();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Open DELETE-B', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open DELETE-A', exact: true })).toHaveCount(0);
  });

  test('renders the Bulgarian list and drawer at desktop/mobile sizes in both themes and changes language', async ({
    page,
    app,
  }) => {
    const bgPath = path.replace('/en/', '/bg/');
    const notes = 'Бележки за автомобила. '.repeat(70);
    await page.goto(app.url + bgPath + '/new');
    await page.getByRole('textbox', { name: /^Регистрационен номер/ }).fill('CB1234AB');
    await page.getByRole('textbox', { name: 'Бележки', exact: true }).fill(notes);
    await page.getByRole('button', { name: 'Създаване на автомобил', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const dark of [false, true]) {
        await setDarkTheme(page, dark);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await page.getByRole('button', { name: 'Действия за CB1234AB', exact: true }).click();
        await chooseMenuItem(page, 'Редактиране');
        const drawer = page.getByRole('dialog', { name: 'Редактиране на CB1234AB', exact: true });
        await expect(drawer.getByRole('textbox', { name: 'Бележки', exact: true })).toHaveValue(
          notes.trim(),
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await drawer.getByRole('button', { name: 'Отказ', exact: true }).click();
        await expect(drawer).toBeHidden();
      }
    }
    await chooseLanguage(page, 'English');
    await expect(page).toHaveURL(app.url + path);
    await expect(page.getByRole('button', { name: 'Open CB1234AB', exact: true })).toBeVisible();
    await chooseLanguage(page, 'Български');
    await expect(page).toHaveURL(app.url + bgPath);
    await expect(
      page.getByRole('button', { name: 'Отваряне на CB1234AB', exact: true }),
    ).toBeVisible();
  });
});
