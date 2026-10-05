import { expect } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const productA = '20000000-0000-4000-8000-000000000001';
const productB = '20000000-0000-4000-8000-000000000002';
const path = `/en/stores/${storeA}/products`;

test('real Products create and edit preserve list state, validate and retain fields on SKU conflict', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(app.url + path + '?search=Editor&pageSize=10&keep=yes#main-content');
  await page.getByRole('link', { name: 'Create product', exact: true }).click();
  await expect(page).toHaveURL(
    app.url + path + '/new?search=Editor&pageSize=10&keep=yes#main-content',
  );
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  const sku = page.getByRole('textbox', { name: 'SKU', exact: true });
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toContainText('Draft');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(name).toBeFocused();
  await expect(page.getByText('Name is required.', { exact: true })).toBeVisible();
  await name.fill(' Editor created ');
  await sku.fill(' BAG-001 ');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  const mutationError = page.locator('holita-product-editor > section').getByRole('alert');
  await expect(mutationError).toContainText('already exists in this store');
  await expect(mutationError).toContainText(/[0-9a-f-]{36}/);
  await expect(name).toHaveValue(' Editor created ');
  await expect(sku).toHaveValue(' BAG-001 ');
  await sku.fill(' EDITOR_NEW ');
  await page.screenshot({
    path: testInfo.outputPath('editor-desktop-light.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath('editor-desktop-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Product saved.');
  await expect(page.getByRole('link', { name: 'Editor created', exact: true })).toBeVisible();
  await expect(page).toHaveURL(app.url + path + '?search=Editor&pageSize=10&keep=yes#main-content');
  await page.getByRole('link', { name: 'Editor created', exact: true }).click();
  await expect(name).toHaveValue('Editor created');
  await expect(sku).toHaveValue('EDITOR_NEW');
  await name.fill('Editor edited');
  await page.getByRole('combobox', { name: 'Status', exact: true }).click();
  await page.getByRole('option', { name: 'Active', exact: true }).click();
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(
    page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name: 'Editor edited', exact: true }) })
      .getByRole('cell', { name: 'Active', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Editor edited', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Editor edited', exact: true }).click();
  await expect(name).toHaveValue('Editor edited');
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toContainText('Active');
  expect(errors).toEqual([]);
});

test('dirty create guards store, language and history navigation, restoring the selector on rejection', async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(app.url + path);
  await page.getByRole('link', { name: 'Create product', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('Unsaved name');
  await chooseStore(page, 'holita Plovdiv');
  const dialog = page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(app.url + path + '/new');
  await expect(page.getByRole('combobox', { name: 'Store', exact: true })).toContainText(
    'holita Sofia',
  );
  await expect(name).toHaveValue('Unsaved name');
  await page.getByRole('link', { name: 'Български', exact: true }).click();
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(name).toHaveValue('Unsaved name');
  const back = page.goBack();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await back;
  await expect(page).toHaveURL(app.url + path + '/new');
  await page.getByRole('link', { name: 'Български', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(app.url + path.replace('/en/', '/bg/') + '/new');
  await expect(page.getByRole('textbox', { name: 'Име', exact: true })).toHaveValue('');
  expect(errors).toEqual([]);
});

test('wrong-store and missing Products expose a diagnostic error instead of an editable form', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/stores/${storeB}/products/${productA}/edit`);
  await expect(page.getByRole('alert')).toContainText('Product not found');
  await expect(page.locator('form')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to products', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Plovdiv notebook', exact: true })).toBeVisible();
  await page.goto(app.url + path + '/not-a-uuid/edit');
  await expect(page.getByRole('alert')).toContainText('Invalid product ID');
  await expect(page.locator('form')).toHaveCount(0);
});

test('a submitted real update survives switching stores and cannot change the new editor or navigate it', async ({
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
    const body: unknown = route.request().postDataJSON();
    if (
      typeof body === 'object' &&
      body !== null &&
      'operationName' in body &&
      body.operationName === 'AdminUpdateProduct'
    ) {
      expect(route.request().headers()['x-store-id']).toBe(storeA);
      expect(route.request().headers()['accept-language']).toBe('en');
      const response = await route.fetch();
      captured();
      await gate;
      await route.fulfill({ response });
      delivered();
    } else await route.continue();
  });
  try {
    await page.goto(app.url + path + `/${productA}/edit`);
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await expect(name).toHaveValue('Sofia notebook');
    await name.fill('Saved in Sofia');
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await capturedResponse;
    await expect(name).toBeDisabled();
    await chooseStore(page, 'holita Plovdiv');
    await page.getByRole('link', { name: 'Plovdiv notebook', exact: true }).click();
    await expect(name).toHaveValue('Plovdiv notebook');
    await name.fill('Current unsaved draft');
    const url = page.url();
    release();
    await deliveredResponse;
    await expect(page).toHaveURL(url);
    await expect(name).toHaveValue('Current unsaved draft');
    await expect(page.getByRole('alert')).toHaveCount(0);
    const response = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': storeA },
      data: {
        query: 'query VerifyEditorWrite($id:ID!){product(id:$id){name}}',
        variables: { id: productA },
      },
    });
    expect(await response.json()).toMatchObject({ data: { product: { name: 'Saved in Sofia' } } });
  } finally {
    release();
  }
});

test('a delayed real update conflict cannot report an error in the next same-store editor', async ({
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
    const body: unknown = route.request().postDataJSON();
    if (
      typeof body === 'object' &&
      body !== null &&
      'operationName' in body &&
      body.operationName === 'AdminUpdateProduct'
    ) {
      const response = await route.fetch();
      captured();
      await gate;
      await route.fulfill({ response });
      delivered();
    } else await route.continue();
  });
  try {
    await page.goto(app.url + path + `/${productB}/edit`);
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Sofia pen');
    await page.getByRole('link', { name: 'Back to products', exact: true }).click();
    await page.getByRole('link', { name: 'Sofia notebook', exact: true }).click();
    await page.getByRole('textbox', { name: 'SKU', exact: true }).fill('PEN-001');
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await capturedResponse;
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible();
    await page.goBack();
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await expect(name).toHaveValue('Sofia pen');
    await name.fill('Current draft');
    release();
    await deliveredResponse;
    await expect(name).toHaveValue('Current draft');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page).toHaveURL(app.url + path + `/${productB}/edit`);
  } finally {
    release();
  }
});

test('Bulgarian create form is usable at 320 px in light and dark themes', async ({
  page,
  app,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(app.url + path.replace('/en/', '/bg/') + '/new');
  await page.getByRole('button', { name: 'Запази продукта', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Име', exact: true });
  await expect(name).toBeFocused();
  await expect(page.getByText('Името е задължително.', { exact: true })).toBeVisible();
  await name.fill('Мобилен продукт');
  await page.getByRole('textbox', { name: 'SKU', exact: true }).fill('MOBILE_EDITOR');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`editor-mobile-${theme}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    if (theme === 'light')
      await page.getByRole('button', { name: 'Включи тъмна тема', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Запази продукта', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Продуктът е запазен.');
  await expect(page.getByRole('link', { name: 'Мобилен продукт', exact: true })).toBeVisible();
});
