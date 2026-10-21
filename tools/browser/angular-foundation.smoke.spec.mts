import { expect, type Request } from '@playwright/test';
import { chooseBranch, chooseLanguage, test } from './angular-fixture.mjs';

const branchA = '10000000-0000-4000-8000-000000000001';

test.beforeEach(async ({ page, app }) => {
  for (const [branchId, licensePlate] of [
    ['10000000-0000-4000-8000-000000000001', 'Discordia truck'],
    ['10000000-0000-4000-8000-000000000002', 'Sandbox truck'],
  ] as const) {
    const response = await page.request.post(app.gatewayUrl, {
      headers: { authorization: `Bearer ${app.demoSession.token}`, 'x-branch-id': branchId },
      data: {
        query: 'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id}}',
        variables: { input: { licensePlate } },
      },
    });
    const body: unknown = await response.json();
    expect(body).toHaveProperty('data.createFleetVehicle.id');
  }
});

const branchB = '10000000-0000-4000-8000-000000000002';

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
  await expect(page).toHaveURL(`${app.url}/en/${branchA}/fleet/overview`);
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByRole('heading', { level: 2 })).toHaveText([
    'Monitoring',
    'Fleet',
    /^Karma Client/,
    'Settings',
  ]);
  await expect(page.getByRole('link', { name: 'Branches', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Vehicles', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/${branchA}/fleet/vehicles`);
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  await chooseBranch(page, 'Sandbox');
  await expect(page.getByRole('button', { name: 'Open Sandbox truck', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Discordia truck', exact: true })).toHaveCount(
    0,
  );
  await chooseBranch(page, 'Discordia');
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Sandbox truck', exact: true })).toHaveCount(
    0,
  );
  expect(scopes).toEqual([branchA, branchB, branchA]);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
  ).toBeVisible();
  await chooseLanguage(page, 'Български');
  await expect(page).toHaveURL(`${app.url}/bg/${branchA}/fleet/vehicles`);
  await expect(page.getByRole('heading', { level: 1, name: /^Автомобили/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await expect(page.locator('aside nav').getByRole('heading', { level: 2 })).toHaveText([
    'Наблюдение',
    'Автопарк',
    /^Karma Client/,
    'Настройки',
  ]);
  await page.getByRole('link', { name: 'Устройства', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/bg/${branchA}/fleet/devices`);
  await expect(page.getByRole('heading', { name: 'Устройства', exact: true })).toBeVisible();
  await chooseBranch(page, 'Sandbox');
  await expect(page).toHaveURL(`${app.url}/bg/${branchB}/fleet/devices`);
  await expect(page.getByRole('heading', { name: 'Устройства', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a delayed real A response cannot replace B and returning to A fetches again', async ({
  page,
  app,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured = () => {};
  const capturedResponse = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let delivered = () => {};
  const deliveredResponse = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  let delayed = false;
  await page.route(app.gatewayUrl, async (route) => {
    if (
      !delayed &&
      operation(route.request(), 'AdminVehicles') &&
      route.request().headers()['x-branch-id'] === branchA
    ) {
      delayed = true;
      const response = await route.fetch();
      captured();
      await gate;
      await route.fulfill({ response });
      delivered();
    } else {
      await route.continue();
    }
  });
  try {
    await page.goto(`${app.url}/en/${branchA}/fleet/vehicles`);
    await capturedResponse;
    await chooseBranch(page, 'Sandbox');
    await expect(
      page.getByRole('button', { name: 'Open Sandbox truck', exact: true }),
    ).toBeVisible();
    release();
    await deliveredResponse;
    await expect(
      page.getByRole('button', { name: 'Open Sandbox truck', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
    ).toHaveCount(0);
    await chooseBranch(page, 'Discordia');
    await expect(
      page.getByRole('button', { name: 'Open Discordia truck', exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});

test('a language change starts a new Vehicles request while the old real response is pending', async ({
  page,
  app,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured = () => {};
  const capturedResponse = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let delivered = () => {};
  const deliveredResponse = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  const scopes: string[] = [];
  await page.route(app.gatewayUrl, async (route) => {
    const request = route.request();
    if (operation(request, 'AdminVehicles')) {
      const language = request.headers()['accept-language'];
      const branchId = request.headers()['x-branch-id'];
      if (!language || !branchId) {
        throw new Error('Missing scoped Vehicles request headers.');
      }
      scopes.push(`${branchId}/${language}`);
      if (language === 'en') {
        const response = await route.fetch();
        captured();
        await gate;
        await route.fulfill({ response });
        delivered();
        return;
      }
    }
    await route.continue();
  });
  try {
    await page.goto(`${app.url}/en/${branchA}/fleet/vehicles`);
    await capturedResponse;
    await chooseLanguage(page, 'Български');
    await expect(page).toHaveURL(`${app.url}/bg/${branchA}/fleet/vehicles`);
    await expect(
      page.getByRole('button', { name: 'Отваряне на Discordia truck', exact: true }),
    ).toBeVisible();
    expect(scopes).toEqual([`${branchA}/en`, `${branchA}/bg`]);
    release();
    await deliveredResponse;
    await expect(page.getByRole('heading', { level: 1, name: /^Автомобили/ })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Отваряне на Discordia truck', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    release();
  }
});
