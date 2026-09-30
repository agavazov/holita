import { expect, type Page, type Request } from '@playwright/test';
import { test } from './fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';

async function switchStore(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Store', exact: true }).press('ArrowDown');
  await page.getByRole('option', { name, exact: true }).click();
}
async function fillProduct(page: Page, name: string, sku: string) {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('SKU', { exact: true }).fill(sku);
}
function operation(request: Request, name: string) {
  const body: unknown = request.postDataJSON();
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

test('store discovery recovers from gateway failure and handles empty and unavailable stores in dark mobile layout', async ({
  page,
  app,
}, testInfo) => {
  let state: 'failure' | 'ready' | 'empty' = 'failure';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      'holita.appearance',
      JSON.stringify({ preset: 'default-dark', mode: 'dark', primaryColor: null }),
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'ListStores')) {
      if (state === 'failure') {
        await route.abort('failed');
        return;
      }
      if (state === 'empty') {
        await route.fulfill({ json: { data: { stores: [] } } });
        return;
      }
    }
    await route.continue();
  });
  await page.goto(app.url);
  await expect(page.getByRole('alert')).toContainText('Could not reach the gateway.');
  await expect(page.locator('html')).toHaveAttribute('data-holita-color-scheme', 'dark');
  await page.screenshot({
    path: testInfo.outputPath('stores-error-mobile-dark.png'),
    fullPage: true,
  });
  state = 'ready';
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Select a store' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'holita Sofia', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('stores-mobile-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'holita Sofia', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await page.goto(`${app.url}/stores/unavailable/products`);
  await expect(page.getByRole('heading', { name: 'Store not found' })).toBeVisible();
  await page.getByRole('button', { name: 'holita Plovdiv', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Plovdiv notebook', exact: true })).toBeVisible();
  state = 'empty';
  await page.goto(app.url);
  await expect(
    page.getByText('No stores available. Ask your workspace administrator to set up a store.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create product' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Products CRUD works through the real gateway for both stores', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(app.url);
  await page.getByRole('button', { name: 'holita Sofia', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('products-list.png'), fullPage: true });
  await page.getByRole('button', { name: 'Create product', exact: true }).click();
  await fillProduct(page, 'Smoke Sofia product', 'SMOKE-001');
  await page.screenshot({ path: testInfo.outputPath('product-form.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save product' }).click();
  await page.getByRole('link', { name: 'Smoke Sofia product', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Smoke Sofia product');
  await page.getByLabel('Name', { exact: true }).fill('Smoke Sofia edited');
  await page.getByRole('combobox', { name: 'Status', exact: true }).press('ArrowDown');
  await page.getByRole('option', { name: 'Active', exact: true }).click();
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Smoke Sofia edited' })).toContainText(
    'Active',
  );
  await page.getByRole('button', { name: 'Create product', exact: true }).click();
  await fillProduct(page, 'Duplicate', 'SMOKE-001');
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'SKU' })).toContainText('already exists');
  await switchStore(page, 'holita Plovdiv');
  await expect(page.getByRole('link', { name: 'Plovdiv notebook', exact: true })).toBeVisible();
  await expect(page.getByText('Smoke Sofia edited')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create product', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  await fillProduct(page, 'Smoke Plovdiv product', 'SMOKE-001');
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(
    page.getByRole('link', { name: 'Smoke Plovdiv product', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Actions for Smoke Plovdiv product', exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Smoke Plovdiv product', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Actions for Smoke Plovdiv product', exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Smoke Plovdiv product', exact: true })).toHaveCount(
    0,
  );
  await switchStore(page, 'holita Sofia');
  await expect(page.getByRole('link', { name: 'Smoke Sofia edited', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Actions for Smoke Sofia edited', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Smoke Sofia edited', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a delayed product response cannot replace the newly selected store', async ({
  page,
  app,
}) => {
  let release: () => void = () => {
    throw new Error('Delay not initialized.');
  };
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let observed: () => void = () => {
    throw new Error('Observer not initialized.');
  };
  const started = new Promise<void>((resolve) => {
    observed = resolve;
  });
  let delayNext = true;
  await page.route(app.gatewayUrl, async (route) => {
    if (
      delayNext &&
      operation(route.request(), 'ListProducts') &&
      route.request().headers()['x-store-id'] === storeA
    ) {
      delayNext = false;
      const response = await route.fetch();
      observed();
      await held;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.goto(`${app.url}/stores/${storeA}/products`);
    await started;
    await switchStore(page, 'holita Plovdiv');
    await expect(page.getByRole('link', { name: 'Plovdiv notebook', exact: true })).toBeVisible();
    const completed = page.waitForResponse(
      (response) =>
        operation(response.request(), 'ListProducts') &&
        response.request().headers()['x-store-id'] === storeA,
    );
    release();
    await completed;
    await expect(page.getByText('Sofia notebook')).toHaveCount(0);
    await switchStore(page, 'holita Sofia');
    await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
    await expect(page.getByText('Plovdiv notebook')).toHaveCount(0);
  } finally {
    release();
  }
});

test('a pending mutation stays in its initiating store and leaves the new draft intact', async ({
  page,
  app,
}) => {
  let release: () => void = () => {
    throw new Error('Delay not initialized.');
  };
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let observed: () => void = () => {
    throw new Error('Observer not initialized.');
  };
  const started = new Promise<void>((resolve) => {
    observed = resolve;
  });
  const mutationStores: (string | undefined)[] = [];
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'CreateProduct')) {
      mutationStores.push(route.request().headers()['x-store-id']);
      const response = await route.fetch();
      observed();
      await held;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.goto(`${app.url}/stores/${storeA}/products/create`);
    await fillProduct(page, 'Pending Sofia product', 'PENDING-001');
    const save = page.getByRole('button', { name: 'Save product' });
    await save.scrollIntoViewIfNeeded();
    const box = await save.boundingBox();
    if (!box) throw new Error('Save product is not visible.');
    // Send both physical clicks even when the first disables the pending button.
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await started;
    await expect(page.getByLabel('Name', { exact: true })).toBeDisabled();
    await switchStore(page, 'holita Plovdiv');
    await page.getByRole('button', { name: 'Create product', exact: true }).click();
    await fillProduct(page, 'Unsaved Plovdiv draft', 'DRAFT-001');
    const completed = page.waitForResponse((response) =>
      operation(response.request(), 'CreateProduct'),
    );
    release();
    await completed;
    await expect(page).toHaveURL(`${app.url}/stores/${storeB}/products/create`);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unsaved Plovdiv draft');
    await expect(page.getByText('Product saved.')).toHaveCount(0);
    expect(mutationStores).toEqual([storeA]);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText('Pending Sofia product')).toHaveCount(0);
    await switchStore(page, 'holita Sofia');
    await expect(
      page.getByRole('link', { name: 'Pending Sofia product', exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});

test('history navigation isolates editors in the same store during a pending create', async ({
  page,
  app,
}) => {
  let release: () => void = () => {
    throw new Error('Delay not initialized.');
  };
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let observed: () => void = () => {
    throw new Error('Observer not initialized.');
  };
  const started = new Promise<void>((resolve) => {
    observed = resolve;
  });
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'CreateProduct')) {
      const response = await route.fetch();
      observed();
      await held;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.goto(`${app.url}/stores/${storeA}/products`);
    await page.getByRole('link', { name: 'Sofia notebook', exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Sofia notebook');
    const editUrl = page.url();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Create product', exact: true }).click();
    await fillProduct(page, 'Pending same-store product', 'HISTORY-001');
    await page.getByRole('button', { name: 'Save product' }).click();
    await started;
    await page.evaluate(() => {
      window.history.go(-2);
    });
    await expect(page).toHaveURL(editUrl);
    await expect(page.getByLabel('Name', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Sofia notebook');
    await page.getByLabel('Name', { exact: true }).fill('Independent unsaved edit');
    const completed = page.waitForResponse((response) =>
      operation(response.request(), 'CreateProduct'),
    );
    release();
    await completed;
    await expect(page).toHaveURL(editUrl);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Independent unsaved edit');
    await expect(page.getByText('Product saved.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Pending same-store product', exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});
