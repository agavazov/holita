import { expect, type Request } from '@playwright/test';
import { chooseBranch, chooseLanguage, test } from './angular-fixture.mjs';

function operation(request: Request, name: string): boolean {
  const body: unknown = request.postDataJSON();
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

test('compiled Angular discovers branches and reads Vehicles through the real gateway in A → B → A', async ({
  page,
  app,
}) => {
  const { branchA, branchB } = app;
  for (const [branch, licensePlate] of [
    [branchA, 'Discordia truck'],
    [branchB, 'Sandbox truck'],
  ] as const) {
    const response = await page.request.post(app.gatewayUrl, {
      headers: { authorization: `Bearer ${app.demoSession.token}`, 'x-branch-id': branch.id },
      data: {
        query: 'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id}}',
        variables: { input: { licensePlate } },
      },
    });
    const body: unknown = await response.json();
    expect(body).toHaveProperty('data.createFleetVehicle.id');
  }
  const errors: string[] = [];
  const scopes: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (
      request.url() === app.gatewayUrl &&
      request.method() === 'POST' &&
      operation(request, 'AdminVehicles')
    ) {
      scopes.push(request.headers()['x-branch-id'] ?? 'missing');
    }
  });
  await page.goto(`${app.url}/en`);
  await expect(page).toHaveURL(`${app.url}/en/${branchA.id}/fleet/overview`);
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByRole('heading', { level: 2 })).toHaveText([
    'Monitoring',
    'Fleet',
    /^Karma Client/,
    'Settings',
  ]);
  await expect(page.getByRole('link', { name: 'Branches', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Vehicles', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/${branchA.id}/fleet/vehicles`);
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  await chooseBranch(page, branchB.name);
  await expect(page.getByRole('button', { name: 'Open Sandbox truck', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Discordia truck', exact: true })).toHaveCount(
    0,
  );
  await chooseBranch(page, branchA.name);
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Sandbox truck', exact: true })).toHaveCount(
    0,
  );
  expect(scopes).toEqual([branchA.id, branchB.id, branchA.id]);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  await chooseLanguage(page, 'Български');
  await expect(page).toHaveURL(`${app.url}/bg/${branchA.id}/fleet/vehicles`);
  await expect(page.getByRole('heading', { level: 1, name: /^Автомобили/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await expect(page.locator('aside nav').getByRole('heading', { level: 2 })).toHaveText([
    'Наблюдение',
    'Автопарк',
    /^Karma Client/,
    'Настройки',
  ]);
  await page.getByRole('link', { name: 'Устройства', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/bg/${branchA.id}/fleet/devices`);
  await expect(page.getByRole('heading', { name: 'Устройства', exact: true })).toBeVisible();
  await chooseBranch(page, branchB.name);
  await expect(page).toHaveURL(`${app.url}/bg/${branchB.id}/fleet/devices`);
  await expect(page.getByRole('heading', { name: 'Устройства', exact: true })).toBeVisible();
  // Below 1024 px the navigation is a drawer that closes on navigation. This step stays last:
  // crossing the breakpoint while the drawer mask fades out leaves the mask over the page.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#desktop-navigation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Отвори или затвори навигацията', exact: true }).click();
  const drawer = page.locator('.app-nav-drawer');
  await drawer.getByRole('link', { name: 'Автомобили', exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(`${app.url}/bg/${branchB.id}/fleet/vehicles`);
  expect(errors).toEqual([]);
});
