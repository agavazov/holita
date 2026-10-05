import { expect } from '@playwright/test';
import { test } from './prototype-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';

test('a delayed Prototype Product response cannot replace the newly selected store', async ({
  page,
  app,
}) => {
  await page.addInitScript((store) => {
    const original = window.fetch.bind(window);
    let delayNext = true;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      if (delayNext && typeof init?.body === 'string') {
        const body: unknown = JSON.parse(init.body);
        if (
          typeof body === 'object' &&
          body !== null &&
          'operationName' in body &&
          body.operationName === 'ListProducts' &&
          new Headers(init.headers).get('x-store-id') === store
        ) {
          delayNext = false;
          document.documentElement.dataset.holitaProductHeld = 'true';
          await new Promise<void>((resolve) => {
            window.addEventListener(
              'holita-release-products',
              () => {
                resolve();
              },
              { once: true },
            );
          });
          document.documentElement.dataset.holitaProductReleased = 'true';
        }
      }
      return response;
    };
  }, storeA);
  try {
    await page.goto(`${app.url}/en/stores/${storeA}/products`);
    await expect(page.locator('html')).toHaveAttribute('data-holita-product-held', 'true');
    await page.getByRole('combobox', { name: 'Store', exact: true }).click();
    await page.getByRole('option', { name: 'holita Plovdiv', exact: true }).click();
    await expect(page).toHaveURL(`${app.url}/en/stores/${storeB}/products`);
    await expect(page.getByRole('link', { name: 'Travel journal', exact: true })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('holita-release-products')));
    await expect(page.locator('html')).toHaveAttribute('data-holita-product-released', 'true');
    await expect(page.getByRole('link', { name: 'Woven rug', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Travel journal', exact: true })).toHaveAttribute(
      'href',
      `/en/stores/${storeB}/products/20000000-0000-4000-8000-000000000108/edit`,
    );
    await page.getByRole('combobox', { name: 'Store', exact: true }).click();
    await page.getByRole('option', { name: 'holita Sofia', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Woven rug', exact: true })).toBeVisible();
  } finally {
    await page.evaluate(() => window.dispatchEvent(new Event('holita-release-products')));
  }
});

test('a pending Prototype Product write keeps its captured store, blocks Reset and preserves a new draft', async ({
  page,
  app,
}) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    let count = 0;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      if (typeof init?.body === 'string') {
        const body: unknown = JSON.parse(init.body);
        if (
          typeof body === 'object' &&
          body !== null &&
          'operationName' in body &&
          body.operationName === 'CreateProduct'
        ) {
          document.documentElement.dataset.holitaProductWrites = String(++count);
          document.documentElement.dataset.holitaProductStore =
            new Headers(init.headers).get('x-store-id') ?? '';
          await new Promise<void>((resolve) => {
            window.addEventListener(
              'holita-release-product-write',
              () => {
                resolve();
              },
              { once: true },
            );
          });
        }
      }
      return response;
    };
  });
  try {
    await page.goto(`${app.url}/en/stores/${storeA}/products/create`);
    await page.getByLabel('Name', { exact: true }).fill('Pending prototype product');
    await page.getByLabel('SKU', { exact: true }).fill('PENDING-PROTOTYPE');
    const save = page.getByRole('button', { name: 'Save product', exact: true });
    await save.scrollIntoViewIfNeeded();
    const box = await save.boundingBox();
    if (!box) throw new Error('Save product is not visible.');
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('html')).toHaveAttribute('data-holita-product-store', storeA);
    await expect(page.getByRole('button', { name: 'Reset demo data', exact: true })).toBeDisabled();
    await page.getByRole('combobox', { name: 'Store', exact: true }).click();
    await page.getByRole('option', { name: 'holita Plovdiv', exact: true }).click();
    await page.getByRole('button', { name: 'Create product', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Unsaved Plovdiv draft');
    await page.getByLabel('SKU', { exact: true }).fill('UNSAVED-PROTOTYPE');
    await page.evaluate(() => window.dispatchEvent(new Event('holita-release-product-write')));
    await expect(page.getByRole('button', { name: 'Reset demo data', exact: true })).toBeEnabled();
    await expect(page).toHaveURL(`${app.url}/en/stores/${storeB}/products/create`);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unsaved Plovdiv draft');
    await expect(page.getByText('Product saved.', { exact: true })).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-holita-product-writes', '1');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Travel journal', exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Pending prototype product', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Store', exact: true }).click();
    await page.getByRole('option', { name: 'holita Sofia', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Pending prototype product', exact: true }),
    ).toBeVisible();
  } finally {
    await page.evaluate(() => window.dispatchEvent(new Event('holita-release-product-write')));
  }
});
