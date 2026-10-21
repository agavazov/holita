import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { chooseBranch, chooseMenuItem, setDarkTheme, test } from './angular-fixture.mjs';
import { workspaceRoot } from '../graphql/contracts.mjs';

const branchA = '10000000-0000-4000-8000-000000000001';
const path = `/en/${branchA}/fleet/devices`;
async function vehicle(
  request: APIRequestContext,
  gatewayUrl: string,
  token: string,
  licensePlate: string,
) {
  const response = await request.post(gatewayUrl, {
    headers: { authorization: `Bearer ${token}`, 'x-branch-id': branchA },
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
async function chooseTruck(page: Page, plate: string, language = 'en') {
  const control = page.getByRole('combobox', {
    name: language === 'en' ? 'Installed in' : 'Монтирано в',
    exact: true,
  });
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
  test('creates multiple devices per vehicle, rejects duplicates, reassigns, reloads and isolates A → B → A', async ({
    page,
    app,
    request,
  }) => {
    const first = await vehicle(request, app.gatewayUrl, app.demoSession.token, 'CA1234AB');
    await vehicle(request, app.gatewayUrl, app.demoSession.token, 'CB5678AB');
    await page.goto(app.url + path + '/new');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByRole('textbox', { name: /^IMEI/ })).toBeFocused();
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
    await expect(page.getByRole('textbox', { name: /^IMEI/ })).toBeFocused();
    await page.getByRole('textbox', { name: /^IMEI/ }).fill('001234567890124');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    const deletion = await request.post(app.gatewayUrl, {
      headers: { authorization: `Bearer ${app.demoSession.token}`, 'x-branch-id': branchA },
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
    await expect(overview.getByRole('textbox')).toHaveCount(0);
    await expect(overview.getByRole('link', { name: 'CA1234AB', exact: true })).toHaveAttribute(
      'href',
      `/en/${branchA}/fleet/vehicles/${first}/overview`,
    );
    await overview.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Installed in', exact: true })).toHaveText(
      'CA1234AB',
    );
    await chooseTruck(page, 'CB5678AB');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(overviewUrl);
    await expect(overview).toBeVisible();
    await overview.locator('button.route-drawer__close').click();
    await expect(page).toHaveURL(app.url + path);
    await page.reload();
    await expect(page.locator('tbody tr').filter({ hasText: '001234567890123' })).toContainText(
      'CB5678AB',
    );
    await page.setViewportSize({ width: 375, height: 812 });
    const table = page.locator('holita-devices-view .p-datatable-table-container');
    const identity = page
      .locator('tbody tr')
      .filter({ hasText: '001234567890123' })
      .locator('td.app-col-identity');
    await identity.scrollIntoViewIfNeeded();
    const initial = await identity.boundingBox();
    expect(initial).not.toBeNull();
    expect(initial?.width).toBeLessThan(200);
    await table.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect
      .poll(async () => {
        const cell = await identity.boundingBox();
        const container = await table.boundingBox();
        return cell && container ? Math.abs(cell.x - container.x) : Infinity;
      })
      .toBeLessThan(2);
    await expect(
      identity.getByRole('button', { name: 'Open device 001234567890123', exact: true }),
    ).toBeInViewport();
    await expect(
      identity.getByRole('button', { name: 'Actions for 001234567890123', exact: true }),
    ).toBeInViewport();
    await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await chooseBranch(page, 'Sandbox');
    await expect(page).toHaveURL(/\/fleet\/devices$/);
    await expect(
      page.getByRole('button', { name: 'Open device 001234567890123', exact: true }),
    ).toHaveCount(0);
    await chooseBranch(page, 'Discordia');
    await page.getByRole('button', { name: 'Actions for 001234567890123', exact: true }).click();
    await chooseMenuItem(page, 'Delete');
    const confirmation = page.getByRole('alertdialog', { name: 'Delete devices?', exact: true });
    await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Devices deleted: 1.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Open device 001234567890123', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Open device 001234567890124', exact: true }),
    ).toBeVisible();
  });
  test('registers stock with the existing catalog and persists explicit installation and metadata clears', async ({
    page,
    app,
    request,
  }) => {
    await vehicle(request, app.gatewayUrl, app.demoSession.token, 'STOCK-VEHICLE');
    await page.goto(app.url + path + '/new');
    const create = page.getByRole('dialog', { name: 'Register device', exact: true });
    await create.getByRole('textbox', { name: /^IMEI/ }).fill('001234567890125');
    const model = create.getByRole('combobox', { name: 'Model', exact: true });
    await model.click();
    await page.getByRole('option', { name: 'STARLINK_TRACKER', exact: true }).click();
    await create.getByRole('textbox', { name: 'Firmware', exact: true }).fill('03.29.02');
    await create
      .getByRole('textbox', { name: 'SIM phone number', exact: true })
      .fill('+359888123456');
    await create.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(create).toBeHidden();
    const row = page.locator('tbody tr').filter({ hasText: '001234567890125' });
    await expect(row).toContainText('In stock');
    await expect(row).toContainText('Not installed');
    await row.getByRole('button', { name: 'Actions for 001234567890125', exact: true }).click();
    await chooseMenuItem(page, 'Edit');
    const edit = page.getByRole('dialog', { name: 'Device 001234567890125', exact: true });
    await expect(edit.getByRole('textbox', { name: 'Firmware', exact: true })).toHaveValue(
      '03.29.02',
    );
    await expect(edit.getByRole('textbox', { name: 'SIM phone number', exact: true })).toHaveValue(
      '+359888123456',
    );
    await chooseTruck(page, 'STOCK-VEHICLE');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(edit).toBeHidden();
    await expect(row).toContainText('STOCK-VEHICLE');
    await row.getByRole('button', { name: 'Actions for 001234567890125', exact: true }).click();
    await chooseMenuItem(page, 'Edit');
    await chooseTruck(page, 'Not installed (in stock)');
    await edit.getByRole('textbox', { name: 'Firmware', exact: true }).fill('');
    await edit.getByRole('textbox', { name: 'SIM phone number', exact: true }).fill('');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(edit).toBeHidden();
    await page.reload();
    await expect(row).toContainText('In stock');
    await row.getByRole('button', { name: 'Actions for 001234567890125', exact: true }).click();
    await chooseMenuItem(page, 'Edit');
    await expect(edit.getByRole('textbox', { name: 'Firmware', exact: true })).toHaveValue('');
    await expect(edit.getByRole('textbox', { name: 'SIM phone number', exact: true })).toHaveValue(
      '',
    );
  });
  test('renders Bulgarian forms and lists in desktop/mobile light and dark themes', async ({
    page,
    app,
    request,
  }) => {
    await vehicle(request, app.gatewayUrl, app.demoSession.token, 'CA1234AB');
    const captures = join(workspaceRoot, '.references/review/devices');
    if (process.env.HOLITA_BROWSER_SCREENSHOTS === '1') {
      await mkdir(captures, { recursive: true });
    }
    await page.goto(app.url + path.replace('/en/', '/bg/') + '/new');
    await page.getByRole('textbox', { name: /^IMEI/ }).fill('001234567890123');
    await chooseTruck(page, 'CA1234AB', 'bg');
    await page.getByRole('button', { name: 'Регистрирай', exact: true }).click();
    const openDevice = page.getByRole('button', {
      name: 'Отвори устройство 001234567890123',
      exact: true,
    });
    const editor = page.getByRole('dialog', { name: 'Устройство 001234567890123', exact: true });
    await expect(openDevice).toBeVisible();
    const overview = page.getByRole('dialog', { name: 'Диагностика', exact: true });
    for (const mode of ['view', 'form', 'list']) {
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const dark of [false, true]) {
          await setDarkTheme(page, dark);
          if (mode === 'form') {
            await page
              .getByRole('button', { name: 'Действия за 001234567890123', exact: true })
              .click();
            await chooseMenuItem(page, 'Редактирай');
            await expect(editor.getByRole('textbox', { name: /^IMEI/ })).toHaveValue(
              '001234567890123',
            );
            await expect(
              editor.getByRole('combobox', { name: 'Монтирано в', exact: true }),
            ).toHaveText('CA1234AB');
          } else if (mode === 'view') {
            await openDevice.click();
            await expect(
              overview.getByRole('button', { name: 'Редактирай', exact: true }),
            ).toBeVisible();
            await expect(overview.getByRole('textbox')).toHaveCount(0);
          } else {
            await expect(openDevice).toBeVisible();
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          ).toBe(true);
          if (process.env.HOLITA_BROWSER_SCREENSHOTS === '1') {
            await page.screenshot({
              path: join(captures, `${mode}-${String(width)}-${dark ? 'dark' : 'light'}.png`),
              fullPage: true,
            });
          }
          if (mode === 'form') {
            // Close the pristine editor before using the account menu outside its modal.
            await editor.getByRole('button', { name: 'Отказ', exact: true }).click();
            await expect(editor).toBeHidden();
          } else if (mode === 'view') {
            await overview.locator('button.route-drawer__close').click();
            await expect(overview).toBeHidden();
          }
        }
      }
    }
  });
});
