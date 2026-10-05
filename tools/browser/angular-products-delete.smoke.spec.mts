import { expect, type Request, type APIRequestContext } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const notebook = '20000000-0000-4000-8000-000000000001';
const pen = '20000000-0000-4000-8000-000000000002';
const path = `/en/stores/${storeA}/products`;
function deletion(request: Request): { id: string } | null {
  const body: unknown = request.postDataJSON();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('operationName' in body) ||
    body.operationName !== 'AdminDeleteProduct' ||
    !('variables' in body)
  )
    return null;
  const variables: unknown = body.variables;
  return typeof variables === 'object' &&
    variables !== null &&
    'id' in variables &&
    typeof variables.id === 'string'
    ? { id: variables.id }
    : null;
}
async function seed(
  request: APIRequestContext,
  gatewayUrl: string,
  name: string,
  sku: string,
): Promise<void> {
  const response = await request.post(gatewayUrl, {
    headers: { 'x-store-id': storeA },
    data: {
      query:
        'mutation SeedDeletionProduct($input:CreateProductInput!){createProduct(input:$input){id}}',
      variables: { input: { name, sku, status: 'DRAFT' } },
    },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    data: { createProduct: { id: expect.any(String) } },
  });
}

test('single deletion requires confirmation, supports keyboard cancellation and persists through reload', async ({
  page,
  app,
}) => {
  const writes: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && request.method() === 'POST') {
      const operation = deletion(request);
      if (operation) {
        writes.push(operation.id);
        expect(request.headers()['x-store-id']).toBe(storeA);
        expect(request.headers()['accept-language']).toBe('en');
      }
    }
  });
  await page.goto(app.url + path);
  const checkbox = page.getByRole('checkbox', { name: 'Select Sofia notebook', exact: true });
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete products?', exact: true });
  await expect(dialog).toContainText('Permanently delete “Sofia notebook”?');
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete selected', exact: true })).toBeFocused();
  expect(writes).toEqual([]);
  const action = page.getByRole('button', { name: 'Delete Sofia notebook', exact: true });
  await action.click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(action).toBeFocused();
  await action.click();
  await dialog.getByRole('button', { name: 'Delete products', exact: true }).click();
  await expect(page.getByText('Deleted products: 1.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('checkbox', { name: 'Select Sofia pen', exact: true }),
  ).not.toBeChecked();
  expect(writes).toEqual([notebook]);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sofia pen', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('real single and page-local batch deletion correct the last page and preserve URL context', async ({
  page,
  app,
}) => {
  for (let index = 0; index < 11; index++) {
    await seed(
      page.request,
      app.gatewayUrl,
      `Delete page ${String(index).padStart(2, '0')}`,
      `DELETE_PAGE_${String(index)}`,
    );
  }
  const ids: string[] = [];
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && request.method() === 'POST') {
      const operation = deletion(request);
      if (operation) ids.push(operation.id);
    }
  });
  await page.goto(
    app.url +
      path +
      '?page=2&pageSize=10&search=Delete%20page&sort=name&order=asc&keep=yes#main-content',
  );
  await page.getByRole('button', { name: 'Delete Delete page 10', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete products?', exact: true });
  await dialog.getByRole('button', { name: 'Delete products', exact: true }).click();
  await expect(page).not.toHaveURL(/[?&]page=2/);
  await expect(page).toHaveURL(/pageSize=10/);
  await expect(page).toHaveURL(/[?&]keep=yes(?:&|#)/);
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator('tbody').getByRole('link')).toHaveCount(10);
  await expect(page.getByText('Deleted products: 1.', { exact: true })).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'Select all products on this page', exact: true })
    .check();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  await expect(dialog).toContainText('these 10 selected products');
  await dialog.getByRole('button', { name: 'Delete products', exact: true }).click();
  await expect(page.getByText('Deleted products: 10.', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'No products match these filters.', exact: true }),
  ).toBeVisible();
  expect(ids).toHaveLength(11);
  expect(new Set(ids).size).toBe(11);
  const response = await page.request.post(app.gatewayUrl, {
    headers: { 'x-store-id': storeA },
    data: { query: 'query VerifyRemainingProducts{products{total}}' },
  });
  expect(await response.json()).toMatchObject({ data: { products: { total: 3 } } });
});

test('a concurrently removed record reports a genuine partial failure without undoing successful deletion', async ({
  page,
  app,
}, testInfo) => {
  await page.goto(app.url + path + '?sort=name&order=asc');
  await page.getByRole('checkbox', { name: 'Select Sofia notebook', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Select Sofia pen', exact: true }).check();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  const response = await page.request.post(app.gatewayUrl, {
    headers: { 'x-store-id': storeA },
    data: {
      query: 'mutation ConcurrentDelete($id:ID!){deleteProduct(id:$id){id}}',
      variables: { id: pen },
    },
  });
  expect(await response.json()).toMatchObject({ data: { deleteProduct: { id: pen } } });
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete products', exact: true })
    .click();
  await expect(
    page.getByText('Deleted products: 1. Failed products: 1.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Sofia pen: Product not found' }),
  ).toContainText(/[0-9a-f-]{36}/);
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sofia pen', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sofia bag', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('partial-delete-light.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath('partial-delete-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.reload();
  await expect(page.locator('tbody').getByRole('link')).toHaveText(['Sofia bag']);
});

test('a failed transport keeps only failed rows selected and retry reaches the real Gateway', async ({
  page,
  app,
}) => {
  let failOnce = true;
  const ids: string[] = [];
  await page.route(app.gatewayUrl, async (route) => {
    const operation = deletion(route.request());
    if (operation) {
      ids.push(operation.id);
      if (operation.id === pen && failOnce) {
        failOnce = false;
        await route.abort('connectionfailed');
        return;
      }
    }
    await route.continue();
  });
  await page.goto(app.url + path + '?sort=name&order=asc');
  await page.getByRole('checkbox', { name: 'Select Sofia notebook', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Select Sofia pen', exact: true }).check();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete products?', exact: true });
  await dialog.getByRole('button', { name: 'Delete products', exact: true }).click();
  await expect(
    page.getByText('Deleted products: 1. Failed products: 1.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Sofia pen: Could not reach the gateway.' }),
  ).toContainText(/[0-9a-f-]{36}/);
  await expect(page.getByRole('checkbox', { name: 'Select Sofia pen', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  await expect(dialog).toContainText('Permanently delete “Sofia pen”?');
  await dialog.getByRole('button', { name: 'Delete products', exact: true }).click();
  await expect(page.getByText('Deleted products: 1.', { exact: true })).toBeVisible();
  await expect(page.locator('tbody').getByRole('link')).toHaveText(['Sofia bag']);
  await expect(page.getByRole('button', { name: 'Delete selected', exact: true })).toHaveCount(0);
  expect(ids).toEqual([notebook, pen, pen]);
});

test('a submitted delete settles in its captured store and navigation stops the unsent batch', async ({
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
  const ids: string[] = [];
  await page.route(app.gatewayUrl, async (route) => {
    const operation = deletion(route.request());
    if (!operation) {
      await route.continue();
      return;
    }
    ids.push(operation.id);
    expect(route.request().headers()['x-store-id']).toBe(storeA);
    expect(route.request().headers()['accept-language']).toBe('en');
    const response = await route.fetch();
    captured();
    await gate;
    await route.fulfill({ response });
    delivered();
  });
  try {
    await page.goto(app.url + path + '?sort=name&order=asc');
    await page.getByRole('checkbox', { name: 'Select Sofia notebook', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Select Sofia pen', exact: true }).check();
    await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete products', exact: true })
      .click();
    await capturedResponse;
    await expect(
      page.getByRole('checkbox', { name: 'Select Sofia pen', exact: true }),
    ).toBeDisabled();
    await chooseStore(page, 'holita Plovdiv');
    const current = page.getByRole('checkbox', { name: 'Select Plovdiv notebook', exact: true });
    await current.check();
    release();
    await deliveredResponse;
    await expect(current).toBeChecked();
    await expect(page).toHaveURL(new RegExp(`/stores/${storeB}/products`));
    await expect(page.getByRole('alert')).toHaveCount(0);
    await chooseStore(page, 'holita Sofia');
    await expect(page.getByRole('link', { name: 'Sofia pen', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toHaveCount(0);
    expect(ids).toEqual([notebook]);
  } finally {
    release();
  }
});

test('Bulgarian deletion confirmation and failed-row retry work at 320 px with a long name in both themes', async ({
  page,
  app,
}, testInfo) => {
  const name = 'Дълъг ' + 'X'.repeat(170);
  await seed(page.request, app.gatewayUrl, name, 'MOBILE_DELETE');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(app.url + path.replace('/en/', '/bg/'));
  const action = page.getByRole('button', { name: 'Изтрий ' + name, exact: true });
  const dialog = page.getByRole('alertdialog', { name: 'Изтриване на продукти?', exact: true });
  const confirmationText = dialog.getByText(
    `Да изтрием ли окончателно „${name}“? Това действие е необратимо.`,
    { exact: true },
  );
  for (const theme of ['light', 'dark']) {
    await action.click();
    await expect(dialog.getByRole('button', { name: 'Отказ', exact: true })).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const messageBox = await confirmationText.boundingBox();
    const dialogBox = await dialog.boundingBox();
    if (!messageBox || !dialogBox || messageBox.width === 0)
      throw new Error('The confirmation message must be visible.');
    expect(messageBox.x + messageBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
    expect(
      await confirmationText.evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`delete-mobile-${theme}.png`),
      animations: 'disabled',
    });
    if (theme === 'light') {
      await dialog.getByRole('button', { name: 'Отказ', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await page.getByRole('button', { name: 'Включи тъмна тема', exact: true }).click();
    }
  }
  await page.route(app.gatewayUrl, async (route) => {
    if (deletion(route.request())) await route.abort('connectionfailed');
    else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Изтрий продуктите', exact: true }).click();
  await expect(
    page.getByText('Изтрити продукти: 0. Неуспешни изтривания: 1.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Избери ' + name, exact: true })).toBeChecked();
  const failure = page.locator('p-message').filter({ hasText: name });
  await expect(failure).toBeVisible();
  expect(await failure.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath('delete-mobile-failure-dark.png'),
    animations: 'disabled',
  });
  await page.unroute(app.gatewayUrl);
  await page.getByRole('button', { name: 'Изтрий избраните', exact: true }).click();
  await dialog.getByRole('button', { name: 'Изтрий продуктите', exact: true }).click();
  await expect(page.getByText('Изтрити продукти: 1.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Изтрий ' + name, exact: true })).toHaveCount(0);
});
