import { expect, type Request } from '@playwright/test';
import { test } from './angular-fixture.mjs';

const store = '10000000-0000-4000-8000-000000000001';
const path = `/en/stores/${store}/products`;

function variables(request: Request) {
  const body: unknown = request.postDataJSON();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('operationName' in body) ||
    body.operationName !== 'AdminProducts' ||
    !('variables' in body)
  )
    return null;
  const value: unknown = body.variables;
  return typeof value === 'object' && value !== null ? value : null;
}

test('Products filters and sorting apply on the server across pages, reload and history', async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  const reads: unknown[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && request.method() === 'POST') {
      const value = variables(request);
      if (value) reads.push(value);
    }
  });
  for (let index = 0; index < 24; index++) {
    const response = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': store },
      data: {
        query:
          'mutation SeedListProduct($input:CreateProductInput!){createProduct(input:$input){id}}',
        variables: {
          input: {
            name: `List product ${String(index).padStart(2, '0')}`,
            sku: `LIST_${String(index).padStart(2, '0')}`,
            status: index % 2 === 0 ? 'ACTIVE' : 'DRAFT',
          },
        },
      },
    });
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({
      data: { createProduct: { id: expect.any(String) } },
    });
  }
  await page.goto(
    `${app.url}${path}?page=2&pageSize=10&search=List%20product&sku=LIST_&status=ACTIVE&sort=name&order=asc&keep=yes#main-content`,
  );
  const rows = page.locator('tbody').getByRole('link');
  const name = page.getByRole('columnheader', { name: 'Name', exact: true });
  await expect(rows).toHaveText(['List product 20', 'List product 22']);
  expect(reads).toHaveLength(1);
  expect(reads[0]).toMatchObject({
    offset: 10,
    limit: 10,
    search: 'List product',
    sku: 'LIST_',
    status: 'ACTIVE',
    sort: { field: 'NAME', direction: 'ASC' },
  });
  await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await name.click();
  await expect(name).toHaveAttribute('aria-sort', 'descending');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toHaveText('List product 22');
  await expect(rows.last()).toHaveText('List product 04');
  await expect(page).not.toHaveURL(/page=2/);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows).toHaveText(['List product 02', 'List product 00']);
  await page.reload();
  await expect(rows).toHaveText(['List product 02', 'List product 00']);
  await expect(name).toHaveAttribute('aria-sort', 'descending');
  await page.getByRole('button', { name: 'Reset sorting', exact: true }).click();
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toHaveText('List product 22');
  await expect(name).toHaveAttribute('aria-sort', 'none');
  await expect(page).not.toHaveURL(/sort=|order=|page=2/);
  await page
    .getByRole('searchbox', { name: 'Search products', exact: true })
    .fill('obsolete draft');
  await page.goBack();
  await expect(rows).toHaveText(['List product 02', 'List product 00']);
  await expect(page.getByRole('searchbox', { name: 'Search products', exact: true })).toHaveValue(
    'List product',
  );
  await page.goForward();
  await expect(rows).toHaveCount(10);
  await page.getByRole('combobox', { name: 'Rows per page', exact: true }).click();
  await page.getByRole('option', { name: '50', exact: true }).click();
  await expect(rows).toHaveCount(12);
  await expect(page).toHaveURL(/pageSize=50/);
  await expect(page).not.toHaveURL(/page=2/);
  await page.getByRole('columnheader', { name: 'SKU', exact: true }).click();
  await expect(page).toHaveURL(/sort=sku&order=asc/);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page).not.toHaveURL(/search=|sku=|status=/);
  await expect(page).toHaveURL(/pageSize=50/);
  await expect(page).toHaveURL(/sort=sku&order=asc/);
  await expect(page).toHaveURL(/[?&]keep=yes(?:&|#)/);
  await expect(page).toHaveURL(/#main-content$/);
  await expect(rows).toHaveCount(27);
  await expect(page.getByRole('searchbox', { name: 'Search products', exact: true })).toHaveValue(
    '',
  );
  expect(reads).not.toContainEqual(expect.objectContaining({ search: 'obsolete draft' }));
  expect(errors).toEqual([]);
});

test('a delayed filtered response cannot replace the current query or restore its old rows', async ({
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
  await page.route(app.gatewayUrl, async (route) => {
    const value = variables(route.request());
    if (value && 'status' in value && value.status === 'ACTIVE') {
      const response = await route.fetch();
      captured();
      await gate;
      await route.fulfill({ response });
      delivered();
    } else await route.continue();
  });
  try {
    await page.goto(app.url + path);
    await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Status', exact: true }).click();
    await page.getByRole('option', { name: 'Active', exact: true }).click();
    await capturedResponse;
    await expect(page.locator('tbody')).not.toContainText('Sofia notebook');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sofia pen', exact: true })).toBeVisible();
    release();
    await deliveredResponse;
    await expect(page).toHaveURL(app.url + path);
    await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sofia pen', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    release();
  }
});

test('Bulgarian filters and pagination remain usable at 320 px in both themes', async ({
  page,
  app,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${app.url}/bg/stores/${store}/products?search=unmatched`);
  await expect(
    page.getByRole('cell', { name: 'Няма продукти с тези филтри.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Изчисти филтрите', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Редове на страница', exact: true }),
  ).toBeVisible();
  await page.getByRole('columnheader', { name: 'Име', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('columnheader', { name: 'Име', exact: true })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  for (const theme of ['light', 'dark']) {
    await expect(page.locator('.p-datatable-mask')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`products-${theme}.png`), fullPage: true });
    if (theme === 'light') {
      await page.getByRole('button', { name: 'Включи тъмна тема', exact: true }).click();
      await page.reload();
      await expect(page.locator('html')).toHaveClass('app-dark');
      await expect(page.getByRole('cell', { name: 'Sofia notebook', exact: true })).toBeVisible();
    }
  }
});
