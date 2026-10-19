import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { chooseBranch, test } from './angular-fixture.mjs';
import { workspaceRoot } from '../graphql/contracts.mjs';

const branchA = '10000000-0000-4000-8000-000000000001';
const path = `/en/${branchA}/fleet/devices`;
async function truck(
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
  await page
    .getByRole('button', { name: language === 'en' ? 'Truck' : 'Камион', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: language === 'en' ? 'Truck' : 'Камион',
    exact: true,
  });
  await dialog.getByRole('option', { name: plate, exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
test.describe('Devices', () => {
  test('creates multiple devices per truck, rejects duplicates, reassigns, reloads and isolates A → B → A', async ({
    page,
    app,
    request,
  }) => {
    const first = await truck(request, app.gatewayUrl, app.demoSession.token, 'CA1234AB');
    await truck(request, app.gatewayUrl, app.demoSession.token, 'CB5678AB');
    await page.goto(app.url + path + '/new');
    await page.getByRole('button', { name: 'Save device', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'IMEI', exact: true })).toBeFocused();
    await page.getByRole('textbox', { name: 'IMEI', exact: true }).fill('001234567890123');
    await chooseTruck(page, 'CA1234AB');
    await page.getByRole('button', { name: 'Save device', exact: true }).click();
    await expect(page.getByText('Device saved.', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Create device', exact: true }).click();
    await page.getByRole('textbox', { name: 'IMEI', exact: true }).fill('001234567890123');
    await chooseTruck(page, 'CA1234AB');
    await page.getByRole('button', { name: 'Save device', exact: true }).click();
    await expect(
      page.getByText('IMEI is already used in this branch.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'IMEI', exact: true })).toBeFocused();
    await page.getByRole('textbox', { name: 'IMEI', exact: true }).fill('001234567890124');
    await page.getByRole('button', { name: 'Save device', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    const deletion = await request.post(app.gatewayUrl, {
      headers: { authorization: `Bearer ${app.demoSession.token}`, 'x-branch-id': branchA },
      data: {
        query: 'mutation($id:ID!){deleteFleetVehicle(id:$id){id}}',
        variables: { id: first },
      },
    });
    expect(await deletion.json()).toMatchObject({ errors: [{ extensions: { code: 'CONFLICT' } }] });
    await page.getByRole('link', { name: '001234567890123', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Truck', exact: true })).toHaveText('CA1234AB');
    await chooseTruck(page, 'CB5678AB');
    await page.getByRole('button', { name: 'Save device', exact: true }).click();
    await expect(page).toHaveURL(app.url + path);
    await page.reload();
    await expect(page.locator('tbody tr').filter({ hasText: '001234567890123' })).toContainText(
      'CB5678AB',
    );
    await chooseBranch(page, 'Sandbox');
    await expect(page).toHaveURL(/\/fleet\/devices$/);
    await expect(page.getByRole('link', { name: '001234567890123', exact: true })).toHaveCount(0);
    await chooseBranch(page, 'Discordia');
    await page.getByRole('button', { name: 'Delete 001234567890123', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Delete devices', exact: true });
    await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await confirmation.getByRole('button', { name: 'Delete devices', exact: true }).click();
    await expect(page.getByText('Deleted devices: 1.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: '001234567890123', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '001234567890124', exact: true })).toBeVisible();
  });
  test('renders Bulgarian forms and lists in desktop/mobile light and dark themes', async ({
    page,
    app,
    request,
  }) => {
    await truck(request, app.gatewayUrl, app.demoSession.token, 'CA1234AB');
    const captures = join(workspaceRoot, '.references/review/devices');
    await mkdir(captures, { recursive: true });
    await page.goto(app.url + path.replace('/en/', '/bg/') + '/new');
    await page.getByRole('textbox', { name: 'IMEI', exact: true }).fill('001234567890123');
    await chooseTruck(page, 'CA1234AB', 'bg');
    for (const mode of ['form', 'list']) {
      if (mode === 'list') {
        await page.getByRole('button', { name: 'Запази устройството', exact: true }).click();
        await expect(
          page.getByRole('link', { name: '001234567890123', exact: true }),
        ).toBeVisible();
      }
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const dark of [false, true]) {
          if (
            (await page
              .locator('html')
              .evaluate((element) => element.classList.contains('app-dark'))) !== dark
          ) {
            await page
              .getByRole('button', {
                name: dark ? 'Включи тъмна тема' : 'Включи светла тема',
                exact: true,
              })
              .click();
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          ).toBe(true);
          await page.screenshot({
            path: join(captures, `${mode}-${String(width)}-${dark ? 'dark' : 'light'}.png`),
            fullPage: true,
          });
        }
      }
    }
  });
});
