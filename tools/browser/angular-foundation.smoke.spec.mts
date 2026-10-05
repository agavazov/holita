import { expect, type Request } from '@playwright/test';
import { test } from './angular-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
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

test('compiled Angular discovers stores and reads Products through the real gateway in A → B → A', async ({
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
      operation(request, 'AdminProducts')
    )
      scopes.push(request.headers()['x-store-id'] ?? 'missing');
  });
  await page.goto(`${app.url}/en`);
  await expect(page.getByRole('heading', { name: 'Hello world — holita' })).toBeVisible();
  await page.getByRole('link', { name: 'holita Sofia', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'holita Plovdiv', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Plovdiv notebook', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'holita Sofia', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Plovdiv notebook', exact: true })).toHaveCount(0);
  expect(scopes).toEqual([storeA, storeB, storeA]);
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Български', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/bg/stores/${storeA}/products`);
  await expect(page.getByRole('heading', { name: 'Продукти — holita Sofia' })).toBeVisible();
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
      operation(route.request(), 'AdminProducts') &&
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
    await page.goto(`${app.url}/en/stores/${storeA}/products`);
    await capturedResponse;
    await page.getByRole('link', { name: 'holita Plovdiv', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Plovdiv notebook', exact: true })).toBeVisible();
    release();
    await deliveredResponse;
    await expect(page.getByRole('cell', { name: 'Plovdiv notebook', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'holita Sofia', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  } finally {
    release();
  }
});
