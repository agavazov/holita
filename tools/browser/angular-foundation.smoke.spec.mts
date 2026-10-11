import { expect, type Request } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';

test.beforeEach(async ({ page, app }) => {
  for (const [storeId, licensePlate] of [
    ['10000000-0000-4000-8000-000000000001', 'Sofia truck'],
    ['10000000-0000-4000-8000-000000000002', 'Plovdiv truck'],
  ] as const) {
    const response = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': storeId },
      data: {
        query:
          'mutation($input:CreateReferenceVehicleInput!){createReferenceVehicle(input:$input){id}}',
        variables: { input: { licensePlate } },
      },
    });
    const body: unknown = await response.json();
    expect(body).toHaveProperty('data.createReferenceVehicle.id');
  }
});

const storeB = '10000000-0000-4000-8000-000000000002';

function operation(request: Request, name: string): boolean {
  const body: unknown = request.postDataJSON();
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

test('compiled Angular discovers stores and reads Vehicles through the real gateway in A → B → A', async ({
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
    )
      scopes.push(request.headers()['x-store-id'] ?? 'missing');
  });
  await page.goto(`${app.url}/en`);
  await expect(page.getByRole('heading', { name: 'Stores', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'holita Sofia', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Sofia truck', exact: true })).toBeVisible();
  await chooseStore(page, 'holita Plovdiv');
  await expect(page.getByRole('cell', { name: 'Plovdiv truck', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sofia truck', exact: true })).toHaveCount(0);
  await chooseStore(page, 'holita Sofia');
  await expect(page.getByRole('cell', { name: 'Sofia truck', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Plovdiv truck', exact: true })).toHaveCount(0);
  expect(scopes).toEqual([storeA, storeB, storeA]);
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Sofia truck', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Български', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/bg/stores/${storeA}/reference/vehicles`);
  await expect(page.getByRole('heading', { name: 'Автомобили', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
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
      route.request().headers()['x-store-id'] === storeA
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
    await page.goto(`${app.url}/en/stores/${storeA}/reference/vehicles`);
    await capturedResponse;
    await chooseStore(page, 'holita Plovdiv');
    await expect(page.getByRole('cell', { name: 'Plovdiv truck', exact: true })).toBeVisible();
    release();
    await deliveredResponse;
    await expect(page.getByRole('cell', { name: 'Plovdiv truck', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sofia truck', exact: true })).toHaveCount(0);
    await chooseStore(page, 'holita Sofia');
    await expect(page.getByRole('cell', { name: 'Sofia truck', exact: true })).toBeVisible();
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
      const storeId = request.headers()['x-store-id'];
      if (!language || !storeId) throw new Error('Missing scoped Vehicles request headers.');
      scopes.push(`${storeId}/${language}`);
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
    await page.goto(`${app.url}/en/stores/${storeA}/reference/vehicles`);
    await capturedResponse;
    await page.getByRole('link', { name: 'Български', exact: true }).click();
    await expect(page).toHaveURL(`${app.url}/bg/stores/${storeA}/reference/vehicles`);
    await expect(page.getByRole('cell', { name: 'Sofia truck', exact: true })).toBeVisible();
    expect(scopes).toEqual([`${storeA}/en`, `${storeA}/bg`]);
    release();
    await deliveredResponse;
    await expect(page.getByRole('heading', { name: 'Автомобили', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sofia truck', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    release();
  }
});
