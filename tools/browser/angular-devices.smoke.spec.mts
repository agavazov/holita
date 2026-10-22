import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { chooseBranch, chooseMenuItem, test } from './angular-fixture.mjs';

interface DevicesApp {
  readonly gatewayUrl: string;
  readonly demoSession: { readonly token: string };
  readonly branchA: { readonly id: string };
}
function headers(app: DevicesApp): Record<string, string> {
  return { authorization: `Bearer ${app.demoSession.token}`, 'x-branch-id': app.branchA.id };
}
async function vehicle(request: APIRequestContext, app: DevicesApp, licensePlate: string) {
  const response = await request.post(app.gatewayUrl, {
    headers: headers(app),
    data: {
      query: 'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id}}',
      variables: { input: { licensePlate } },
    },
  });
  expect(response.ok()).toBe(true);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('Missing truck result');
  }
  const data = body.data;
  if (typeof data !== 'object' || data === null || !('createFleetVehicle' in data)) {
    throw new Error('Missing truck');
  }
  const row = data.createFleetVehicle;
  if (typeof row !== 'object' || row === null || !('id' in row) || typeof row.id !== 'string') {
    throw new Error('Missing truck ID');
  }
  return row.id;
}
async function chooseTruck(page: Page, plate: string) {
  const control = page.getByRole('combobox', { name: 'Installed in', exact: true });
  await control.click();
  const listboxId = await control.getAttribute('aria-controls');
  if (!listboxId) {
    throw new Error('Missing installation listbox.');
  }
  await page
    .locator(`[id="${listboxId}"]`)
    .getByRole('option', { name: plate, exact: true })
    .click();
  await expect(control).toHaveAttribute('aria-expanded', 'false');
}
test.describe('Devices', () => {
  test('registers and reassigns devices, rejects a duplicate IMEI, stores installation time in the Branch time zone and isolates A → B → A', async ({
    page,
    app,
    request,
  }) => {
    const path = `/en/${app.branchA.id}/fleet/devices`;
    // Belgrade differs from both the Sofia development host and UTC CI.
    const settings = await request.post(app.gatewayUrl, {
      headers: headers(app),
      data: {
        query: `mutation {
          updateFleetSettings(input: {
            timeZone: "Europe/Belgrade", distanceUnit: KM, volumeUnit: LITRE,
            lowFuelPct: 12, notReportingHours: 48, speedLimitKph: 90
          }) { timeZone }
        }`,
      },
    });
    expect(await settings.json()).toEqual({
      data: { updateFleetSettings: { timeZone: 'Europe/Belgrade' } },
    });
    const first = await vehicle(request, app, 'CA1234AB');
    await vehicle(request, app, 'CB5678AB');
    await page.goto(app.url + path + '/new');
    await page.getByRole('textbox', { name: /^IMEI/ }).fill('001234567890123');
    await chooseTruck(page, 'CA1234AB');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(
      page.getByText('Device 001234567890123 was registered.', { exact: true }),
    ).toBeVisible();
    await page
      .locator('holita-page-header')
      .getByRole('button', { name: 'Register device', exact: true })
      .click();
    await page.getByRole('textbox', { name: /^IMEI/ }).fill('001234567890123');
    await chooseTruck(page, 'CA1234AB');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByText('This IMEI is already registered.', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: /^IMEI/ }).fill('001234567890124');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    const deletion = await request.post(app.gatewayUrl, {
      headers: headers(app),
      data: {
        query: 'mutation($id:ID!){deleteFleetVehicle(id:$id){id}}',
        variables: { id: first },
      },
    });
    expect(await deletion.json()).toMatchObject({ errors: [{ extensions: { code: 'CONFLICT' } }] });
    await page.getByRole('button', { name: 'Open device 001234567890123', exact: true }).click();
    await expect(page).toHaveURL(/\/diagnostics$/);
    const overviewUrl = page.url();
    const overview = page.getByRole('dialog', { name: 'Diagnostics', exact: true });
    await overview.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Device 001234567890123', exact: true });
    await expect(edit.getByRole('combobox', { name: 'Installed in', exact: true })).toHaveText(
      'CA1234AB',
    );
    await chooseTruck(page, 'CB5678AB');
    const installedAt = edit.getByLabel('Installed at', { exact: true });
    await expect(edit.locator('#device-installedAt-hint')).toContainText('Europe/Belgrade');
    // 02:30 does not exist in Belgrade on the spring DST change (it does in Sofia).
    await installedAt.fill('2026-03-29T02:30');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(installedAt).toHaveAttribute('aria-invalid', 'true');
    await installedAt.fill('2026-10-18T09:00:15.125');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(overviewUrl);
    await expect(overview).toBeVisible();
    await overview.locator('button.route-drawer__close').click();
    await expect(page).toHaveURL(app.url + path);
    await page.reload();
    await expect(page.locator('tbody tr').filter({ hasText: '001234567890123' })).toContainText(
      'CB5678AB',
    );
    const persisted = await request.post(app.gatewayUrl, {
      headers: headers(app),
      data: { query: '{ fleetDevices { items { imei installedAt } } }' },
    });
    expect(await persisted.json()).toMatchObject({
      data: {
        fleetDevices: {
          items: expect.arrayContaining([
            { imei: '001234567890123', installedAt: '2026-10-18T07:00:15.125Z' },
          ]),
        },
      },
    });
    await chooseBranch(page, app.branchB.name);
    await expect(page).toHaveURL(/\/fleet\/devices$/);
    await expect(
      page.getByRole('button', { name: 'Open device 001234567890123', exact: true }),
    ).toHaveCount(0);
    await chooseBranch(page, app.branchA.name);
    await page.getByRole('button', { name: 'Actions for 001234567890123', exact: true }).click();
    await chooseMenuItem(page, 'Delete');
    await page
      .getByRole('alertdialog', { name: 'Delete devices?', exact: true })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page.getByText('Devices deleted: 1.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Open device 001234567890123', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Open device 001234567890124', exact: true }),
    ).toBeVisible();
  });
});
