import { expect } from '@playwright/test';
import { test } from './prototype-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const catalog = `/en/stores/${storeA}/ui-catalog`;

test('UI catalog reuses interactive list patterns without changing persisted prototype records', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/stores/${storeA}/reference/tags`);
  await expect(page.getByRole('link', { name: 'Sport', exact: true })).toBeVisible();
  const savedData = await page.evaluate(() => localStorage.getItem('holita.prototype.data'));
  const operations: string[] = [];
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(app.url)) external.push(request.url());
    if (request.url().includes('/__prototype/graphql')) {
      const body: unknown = request.postDataJSON();
      if (
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        typeof body.operationName === 'string'
      )
        operations.push(body.operationName);
    }
  });
  await page.getByRole('menuitem', { name: 'UI catalog', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UI catalog', level: 1 })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'UI catalog', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('button', { name: 'Primary action', exact: true }).click();
  await expect(page.getByText('Primary action activated.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'More details', exact: true }).click();
  await expect(
    page.getByText('Use a disclosure for supplementary information.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Lists & menus', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}${catalog}?tab=lists`);
  const grid = page.getByRole('grid', { name: 'Catalog examples' });
  await expect(grid.getByRole('button', { name: 'Linen tote', exact: true })).toBeVisible();
  await grid.getByRole('checkbox').first().check();
  await expect(page.getByText('5 selected on this page', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete selected', exact: true })).toHaveCount(0);
  await expect(grid.getByRole('button', { name: 'Canvas pouch', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search examples', exact: true }).fill('Linen');
  await expect(grid.getByRole('button', { name: 'Linen tote', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Catalog filters' });
  await filters.getByRole('combobox', { name: 'Example status' }).click();
  await page.getByRole('option', { name: 'Active', exact: true }).click();
  await filters.getByRole('button', { name: 'Close filters' }).click();
  await expect(grid.getByText('No examples match these filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await filters.getByRole('button', { name: 'Clear filters' }).click();
  await filters.getByRole('button', { name: 'Close filters' }).click();
  await grid.getByRole('button', { name: 'Actions for Linen tote', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit example', exact: true });
  await editor.getByRole('textbox', { name: 'Example name' }).fill('');
  await editor.getByRole('button', { name: 'Save example' }).click();
  await expect(editor.getByText('Enter a name.', { exact: true })).toBeVisible();
  await editor.getByRole('textbox', { name: 'Example name' }).fill('Edited catalog item');
  await editor.getByRole('button', { name: 'Save example' }).click();
  await expect(
    grid.getByRole('button', { name: 'Edited catalog item', exact: true }),
  ).toBeVisible();
  await grid.getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Delete catalog examples?' });
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    grid.getByRole('button', { name: 'Edited catalog item', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Delete examples', exact: true }).click();
  await expect(grid.getByRole('button', { name: 'Edited catalog item', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Add example', exact: true }).click();
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(grid.getByRole('button', { name: 'New example', exact: true })).toHaveCount(0);
  expect(operations.filter((name) => name !== 'ListStores')).toEqual([]);
  expect(external).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('holita.prototype.data'))).toBe(savedData);
  await page.getByRole('menuitem', { name: 'Tags', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sport', exact: true })).toBeVisible();
});

test('catalog forms validate and preserve inputs across state previews, then reset on store switching', async ({
  page,
  app,
}, testInfo) => {
  await page.goto(`${app.url}${catalog}?tab=forms`);
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  const email = page.getByRole('textbox', { name: 'Contact email' });
  const save = page.getByRole('button', { name: 'Save example', exact: true });
  await save.click();
  await expect(name).toBeFocused();
  await expect(page.getByText('Enter a name.', { exact: true })).toBeVisible();
  await name.fill('Catalog form draft');
  await save.click();
  await expect(email).toBeFocused();
  await email.fill('review@example.com');
  const quantity = page.getByRole('spinbutton', { name: 'Quantity' });
  await quantity.fill('0');
  await save.click();
  await expect(quantity).toBeFocused();
  await quantity.fill('3');
  await page.getByRole('combobox', { name: 'Category', exact: true }).click();
  await page.getByRole('option', { name: 'Home', exact: true }).click();
  await page.getByRole('combobox', { name: 'Labels', exact: true }).fill('Featured');
  await page.getByRole('option', { name: 'Featured', exact: true }).click();
  await page.keyboard.press('Escape');
  const state = page.getByRole('combobox', { name: 'Form state', exact: true });
  await state.click();
  await page.getByRole('option', { name: 'Saving', exact: true }).click();
  await expect(name).toBeDisabled();
  await expect(save).toBeDisabled();
  await state.click();
  await page.getByRole('option', { name: 'Save error', exact: true }).click();
  await expect(name).toHaveValue('Catalog form draft');
  await expect(page.getByText('The example could not be saved.', { exact: false })).toBeVisible();
  await save.click();
  await expect(
    page.getByText('Example saved on this page. No prototype records were changed.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Record ID', exact: true })).toHaveAttribute(
    'readonly',
  );
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath('catalog-form-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('combobox', { name: 'Store', exact: true }).click();
  await page.getByRole('option', { name: 'holita Plovdiv', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/stores/${storeB}/ui-catalog`);
  await expect(page.getByRole('tab', { name: 'Body & actions', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Forms', exact: true }).click();
  await expect(name).toHaveValue('');
  await expect(email).toHaveValue('');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Forms', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(name).toHaveValue('');
});

test('catalog states, confirmations and tabs remain usable in dark mode at 320 px', async ({
  page,
  app,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${app.url}${catalog}?tab=forms`);
  await expect(page.getByRole('tab', { name: 'Forms', exact: true })).toBeInViewport({ ratio: 1 });
  await page.goto(`${app.url}/en/stores/${storeA}/reference/tags`);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Navigation' })
    .getByRole('menuitem', { name: 'UI catalog', exact: true })
    .click();
  await page.getByRole('tab', { name: 'States & feedback', exact: true }).click();
  const state = page.getByRole('combobox', { name: 'Content state', exact: true });
  for (const label of ['Loading', 'Empty', 'Error', 'Disabled']) {
    await state.click();
    await page.getByRole('option', { name: label, exact: true }).click();
    if (label === 'Loading') await expect(page.getByRole('status')).toHaveText('Loading example…');
    if (label === 'Empty')
      await expect(page.getByText('No examples yet', { exact: true })).toBeVisible();
    if (label === 'Error')
      await expect(page.getByText('Could not load examples', { exact: true })).toBeVisible();
    if (label === 'Disabled')
      await expect(page.getByRole('button', { name: 'Unavailable action' })).toBeDisabled();
  }
  await state.click();
  await page.getByRole('option', { name: 'Error', exact: true }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Could not load examples' })
    .getByRole('button', { name: 'Retry' })
    .click();
  await expect(page.getByText('Example content is available', { exact: true })).toBeVisible();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Could not refresh data' })
    .getByRole('button', { name: 'Retry' })
    .click();
  await expect(
    page.getByText('Example refresh completed. Existing content was kept.', { exact: true }),
  ).toBeVisible();
  const open = page.getByRole('button', { name: 'Open confirmation', exact: true });
  await open.click();
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
  await open.click();
  await page
    .getByRole('dialog', { name: 'Delete this example?' })
    .getByRole('button', { name: 'Confirm example' })
    .click();
  await expect(
    page.getByText('Example action confirmed. No records were changed.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-holita-color-scheme', 'dark');
  await page.getByRole('tab', { name: 'Forms', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Catalog form settings' })).toBeVisible();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath('catalog-form-mobile-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('tab', { name: 'Lists & menus', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Catalog examples' })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
