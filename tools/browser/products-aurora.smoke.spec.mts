import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const captures = 'artifacts/aurora/products/integration';

test('Aurora Products sorts across server pages and preserves filters through reload and history', async ({
  page,
  app,
}) => {
  for (let index = 0; index < 11; index++) {
    const suffix = String(index).padStart(2, '0');
    const response = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': storeA },
      data: {
        query: 'mutation($input:CreateProductInput!){createProduct(input:$input){id}}',
        variables: {
          input: { name: `Sort product ${suffix}`, sku: `SORT_${suffix}`, status: 'ACTIVE' },
        },
      },
    });
    expect(await response.json()).toMatchObject({
      data: { createProduct: { id: expect.any(String) } },
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `${app.url}/stores/${storeA}/products?search=Sort+product&sku=SORT_&status=ACTIVE&pageSize=10&page=2`,
  );
  const name = page.getByRole('columnheader', { name: /^Name\b/ });
  const rows = page.getByRole('grid').getByRole('link');
  await expect(rows).toHaveText(['Sort product 00']);
  await page.getByRole('checkbox', { name: 'Select all rows', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Delete selected' })).toBeVisible();
  await name.click();
  await expect(name).toHaveAttribute('aria-sort', 'ascending');
  await expect(name).toHaveCSS('outline-style', 'solid');
  await expect(name).toHaveCSS('outline-width', '2px');
  await expect(rows.first()).toHaveText('Sort product 00');
  await expect(rows).toHaveCount(10);
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByRole('button', { name: 'Delete selected' })).toHaveCount(0);
  await expect(page).toHaveURL(/sort=name&order=asc/);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows).toHaveText(['Sort product 10']);
  await name.click();
  await expect(name).toHaveAttribute('aria-sort', 'descending');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toHaveText('Sort product 10');
  await expect(rows.last()).toHaveText('Sort product 01');
  await expect(page).not.toHaveURL(/page=2/);
  await page.reload();
  await expect(name).toHaveAttribute('aria-sort', 'descending');
  await expect(rows.first()).toHaveText('Sort product 10');
  await expect(page.getByRole('searchbox', { name: 'Search products' })).toHaveValue(
    'Sort product',
  );
  await expect(page).toHaveURL(/sku=SORT_/);
  await expect(page.getByRole('tab', { name: 'Active', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await name.click();
  await expect(page).not.toHaveURL(/sort=|order=/);
  await expect(name).toHaveAttribute('aria-sort', 'none');
  await expect(rows.first()).toHaveText('Sort product 10');
  await page.goBack();
  await expect(name).toHaveAttribute('aria-sort', 'descending');
  await expect(rows.first()).toHaveText('Sort product 10');
  await page.getByRole('columnheader', { name: 'SKU', exact: true }).click();
  await expect(rows.first()).toHaveText('Sort product 00');
  await expect(page).toHaveURL(/sort=sku&order=asc/);
  await rows.first().focus();
  const focusedCell = page.getByRole('gridcell', { name: 'Sort product 00', exact: true });
  await expect(focusedCell).toHaveCSS('outline-style', 'solid');
  await expect(focusedCell).toHaveCSS('outline-width', '2px');
  await page.getByRole('button', { name: 'Filter products' }).click();
  await page
    .getByRole('dialog', { name: 'Product filters' })
    .getByRole('button', { name: 'Clear filters' })
    .click();
  await expect(page).not.toHaveURL(/search=|sku=|status=/);
  await expect(page).toHaveURL(/sort=sku&order=asc/);
});

test('Aurora Products applies server filters, resets selection and deletes selected records', async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (let index = 0; index < 22; index++) {
    const response = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': storeA },
      data: {
        query: 'mutation($input:CreateProductInput!){createProduct(input:$input){id}}',
        variables: {
          input: {
            name: `Review product ${String(index).padStart(2, '0')}`,
            sku: `REVIEW_${String(index).padStart(2, '0')}`,
            status: index < 2 ? 'ACTIVE' : 'DRAFT',
          },
        },
      },
    });
    expect(await response.json()).toMatchObject({
      data: { createProduct: { id: expect.any(String) } },
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${app.url}/stores/${storeA}/products`);
  await expect(page.getByRole('link', { name: 'Review product 21', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Select all rows', exact: true }).check();
  await expect(page.getByText('20 selected on this page')).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Review product 00', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete selected' })).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('link', { name: 'Review product 00', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search products' }).fill('review product');
  await expect(page).not.toHaveURL(/page=2/);
  await page.getByRole('tab', { name: 'Active', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Review product 00', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review product 21', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/search=review/);
  await expect(page).toHaveURL(/status=ACTIVE/);
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search products' })).toHaveValue(
    'review product',
  );
  await expect(page.getByRole('tab', { name: 'Active', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Filter products' }).click();
  const filters = page.getByRole('dialog', { name: 'Product filters' });
  await filters.getByLabel('SKU contains').fill('review_00');
  await expect(page).toHaveURL(/sku=review_00/);
  await filters.getByRole('button', { name: 'Close filters' }).click();
  await expect(page.getByRole('link', { name: 'Review product 01', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Review product 00', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filter products' }).click();
  await filters.getByLabel('SKU contains').fill('');
  await filters.getByRole('button', { name: 'Close filters' }).click();
  await expect(page.getByRole('link', { name: 'Review product 01', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Select all rows', exact: true }).check();
  await page.getByRole('button', { name: 'Delete selected' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete 2 products?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Review product 00', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete selected' }).click();
  await page.getByRole('button', { name: 'Delete products', exact: true }).click();
  await expect(page.getByText('2 products deleted.')).toBeVisible();
  await expect(page.getByText('No products match these filters.')).toBeVisible();
  await page.goto(`${app.url}/stores/${storeB}/products`);
  await expect(page.getByRole('link', { name: 'Plovdiv notebook', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Aurora Products synchronizes quick and panel search and clears combined filters', async ({
  page,
  app,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${app.url}/stores/${storeA}/products`);
  const quickSearch = page.locator('#product-search');
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await quickSearch.fill('notebook');
  await page.getByRole('button', { name: 'Filter products' }).click();
  const filters = page.getByRole('region', { name: 'Product filters' });
  const panelSearch = filters.getByRole('searchbox', { name: 'Search products' });
  await expect(panelSearch).toHaveValue('notebook');
  await expect(page.getByRole('link', { name: 'Sofia bag', exact: true })).toHaveCount(0);
  await panelSearch.fill('bag');
  await expect(quickSearch).toHaveValue('bag');
  await expect(page.getByRole('link', { name: 'Sofia bag', exact: true })).toBeVisible();
  await filters.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'Draft', exact: true }).click();
  await expect(page.getByText('No products match these filters.')).toBeVisible();
  await panelSearch.fill('pen');
  await filters.getByLabel('SKU contains').fill('PEN');
  await expect(page.getByRole('link', { name: 'Sofia pen', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/sku=PEN/);
  await page.reload();
  await expect(quickSearch).toHaveValue('pen');
  await page.getByRole('button', { name: 'Filter products' }).click();
  await expect(panelSearch).toHaveValue('pen');
  await expect(filters.getByLabel('SKU contains')).toHaveValue('PEN');
  await expect(filters.getByRole('combobox', { name: 'Status' })).toHaveText('Draft');
  await filters.getByRole('button', { name: 'Clear filters' }).click();
  await expect(panelSearch).toHaveValue('');
  await expect(quickSearch).toHaveValue('');
  await expect(filters.getByLabel('SKU contains')).toHaveValue('');
  await expect(filters.getByRole('combobox', { name: 'Status' })).toHaveText('All statuses');
  await expect(filters.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  await expect(page).not.toHaveURL(/search=|status=|sku=/);
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sofia bag', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sofia pen', exact: true })).toBeVisible();
});

test('Aurora Products provides responsive lists, menus and the Create Event form layout', async ({
  page,
  app,
}) => {
  await mkdir(captures, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${app.url}/stores/${storeA}/products`);
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({ path: `${captures}/desktop-list.png`, animations: 'disabled' });
  await page.getByRole('button', { name: 'Actions for Sofia notebook' }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
  await page.screenshot({ path: `${captures}/row-menu.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByRole('button', { name: 'Filter products' }).click();
  const filters = page.getByRole('region', { name: 'Product filters' });
  await expect(filters).toHaveCSS('transform', 'none');
  await expect(filters).toHaveCSS('width', '280px');
  await page.screenshot({ path: `${captures}/desktop-filters.png`, animations: 'disabled' });
  await filters.getByRole('button', { name: 'Close filters' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Create product', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Review notebook');
  await page.getByLabel('SKU', { exact: true }).fill('REVIEW-001');
  const aside = page.getByRole('complementary', { name: 'Product settings' });
  await expect(aside).toHaveCSS('position', 'sticky');
  await page.screenshot({ path: `${captures}/desktop-form.png`, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(aside).toHaveCSS('position', 'static');
  await page.screenshot({
    path: `${captures}/mobile-form.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${captures}/mobile-list.png`, animations: 'disabled' });
  await page.getByRole('button', { name: 'Filter products' }).click();
  await expect(page.getByRole('dialog', { name: 'Product filters' })).toBeVisible();
  await page.screenshot({ path: `${captures}/mobile-filters.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Filter products' })).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Theme presets' })).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-holita-color-scheme', 'dark');
  await page.screenshot({ path: `${captures}/desktop-dark.png`, animations: 'disabled' });
  expect(errors).toEqual([]);
});
