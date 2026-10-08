import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';
import { workspaceRoot } from '../graphql/contracts.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const catalogPath = `/en/stores/${storeA}/ui-catalog`;
const storageKey = 'holita.admin.prototype.data';

async function choose(page: Page, name: string, option: string): Promise<void> {
  const control = page.getByRole('combobox', { name, exact: true });
  await expect(page.getByRole('listbox', { includeHidden: true })).toHaveCount(0);
  await control.click();
  await expect(control).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('option', { name: option, exact: true }).click();
  if ((await control.getAttribute('aria-expanded')) === 'true') await control.press('Escape');
  await expect(control).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('listbox', { includeHidden: true })).toHaveCount(0);
}

function businessRequests(page: Page) {
  const operations: string[] = [];
  const external: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    const url = new URL(request.url());
    if (!url.pathname.endsWith('/graphql')) return;
    const body: unknown = request.postDataJSON();
    if (
      typeof body === 'object' &&
      body !== null &&
      'operationName' in body &&
      typeof body.operationName === 'string'
    )
      operations.push(body.operationName);
    if (url.origin !== new URL(page.url()).origin) external.push(request.url());
  });
  return { operations, external };
}

test.describe('Sakai local UI catalog', () => {
  test.use({ dataSource: 'mock' });

  test('local list paging, filters, menu, edit, create and confirmed deletion leave persisted data untouched', async ({
    page,
    app,
  }) => {
    await page.goto(`${app.url}/en/stores/${storeA}/reference/tags`);
    await expect(page.getByRole('link', { name: 'Sport', exact: true })).toBeVisible();
    const before = await page.evaluate((key) => localStorage.getItem(key), storageKey);
    const requests = businessRequests(page);
    await page.locator('aside').getByRole('link', { name: 'UI catalog', exact: true }).click();
    await expect(page).toHaveURL(app.url + catalogPath);
    await page.getByRole('button', { name: 'Primary action', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Example action completed locally.');
    const disclosure = page.getByRole('button', { name: 'More details', exact: true });
    await disclosure.focus();
    await disclosure.press('Enter');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('tab', { name: 'Lists and menus', exact: true }).click();
    await expect(page).toHaveURL(app.url + catalogPath + '?tab=lists');
    await page.getByRole('checkbox', { name: 'Select examples on this page', exact: true }).check();
    await expect(
      page.getByRole('button', { name: 'Delete selected examples', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Canvas pouch', exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Delete selected examples', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Search examples', exact: true }).fill('Linen');
    await expect(page.getByRole('button', { name: 'Linen tote', exact: true })).toBeVisible();
    await choose(page, 'Status', 'Active');
    await expect(
      page.getByRole('cell', { name: 'No examples match these filters.', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Select examples on this page', exact: true }).check();
    const codeHeader = page.getByRole('columnheader').filter({ hasText: 'Code' });
    await codeHeader.focus();
    await codeHeader.press('Enter');
    await expect(codeHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(
      page.getByRole('button', { name: 'Delete selected examples', exact: true }),
    ).toHaveCount(0);
    await codeHeader.press('Enter');
    await expect(codeHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(page.locator('tbody tr').first()).toContainText('Studio pen');
    await codeHeader.press('Enter');
    const rowMenu = page.getByRole('button', { name: 'Actions for Linen tote', exact: true });
    await rowMenu.focus();
    await rowMenu.press('Enter');
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit example', exact: true });
    await edit.getByRole('textbox', { name: 'Name', exact: true }).fill('');
    await edit.getByRole('button', { name: 'Save example', exact: true }).click();
    await expect(edit).toContainText('Name is required.');
    await expect(edit.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused();
    await edit.getByRole('textbox', { name: 'Name', exact: true }).fill('Catalog edited example');
    await edit.getByRole('button', { name: 'Save example', exact: true }).click();
    await expect(edit).toHaveCount(0);
    await expect(rowMenu).toHaveCount(0);
    await page
      .getByRole('checkbox', { name: 'Select Catalog edited example', exact: true })
      .check();
    await page.getByRole('button', { name: 'Delete selected examples', exact: true }).click();
    let confirmation = page.getByRole('dialog', { name: 'Delete examples?', exact: true });
    await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(confirmation).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Delete selected examples', exact: true }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Delete selected examples', exact: true }).click();
    confirmation = page.getByRole('dialog', { name: 'Delete examples?', exact: true });
    await confirmation.getByRole('button', { name: 'Delete examples', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Catalog edited example', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Add example', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Add example', exact: true });
    await create.getByRole('textbox', { name: 'Name', exact: true }).fill('Local created example');
    await create.getByRole('button', { name: 'Save example', exact: true }).click();
    await page
      .getByRole('searchbox', { name: 'Search examples', exact: true })
      .fill('Local created');
    await expect(
      page.getByRole('button', { name: 'Local created example', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Local created example', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'View example', exact: true })).toContainText(
      'EX-013',
    );
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Body and actions', exact: true }).click();
    await page.getByRole('tab', { name: 'Lists and menus', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Linen tote', exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Local created example', exact: true }),
    ).toHaveCount(0);
    expect(requests.operations.every((name) => name === 'AdminStores')).toBe(true);
    expect(requests.external).toEqual([]);
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(before);
    await page.locator('aside').getByRole('link', { name: 'Tags', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Sport', exact: true })).toBeVisible();
  });

  test('typed form validates, retains failed and pending drafts, resets on store/language/reload and browser history', async ({
    page,
    app,
  }) => {
    const requests = businessRequests(page);
    await page.goto(app.url + catalogPath + '?tab=forms');
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    const email = page.getByRole('textbox', { name: 'Email', exact: true });
    const quantity = page.getByRole('spinbutton', { name: 'Quantity', exact: true });
    const save = page.getByRole('button', { name: 'Save example', exact: true });
    await save.click();
    await expect(name).toBeFocused();
    await name.fill('Example draft');
    await save.click();
    await expect(email).toBeFocused();
    await email.fill('preview@example.com');
    await quantity.fill('1.5');
    await save.click();
    await expect(quantity).toBeFocused();
    await quantity.fill('3');
    await choose(page, 'Category', 'Home');
    await choose(page, 'Labels', 'Featured');
    await choose(page, 'Form state', 'Saving');
    await expect(name).toBeDisabled();
    await expect(save).toBeDisabled();
    await choose(page, 'Form state', 'Save error');
    await expect(name).toHaveValue('Example draft');
    await expect(quantity).toHaveValue('3');
    await expect(
      page.getByText('Example save failed. Your entered values are retained.', { exact: true }),
    ).toBeVisible();
    await save.click();
    await expect(page.getByRole('status')).toContainText('Example saved locally.');
    await expect(page.getByRole('textbox', { name: 'Record ID', exact: true })).toHaveAttribute(
      'readonly',
      '',
    );
    await chooseStore(page, 'holita Plovdiv');
    await expect(page).toHaveURL(app.url + catalogPath.replace(storeA, storeB));
    await page.getByRole('tab', { name: 'Forms', exact: true }).click();
    await expect(name).toHaveValue('');
    await name.fill('B draft');
    await chooseStore(page, 'holita Sofia');
    await page.getByRole('tab', { name: 'Forms', exact: true }).click();
    await expect(name).toHaveValue('');
    await name.fill('Language draft');
    await page.getByRole('link', { name: 'Български', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Име', exact: true })).toHaveValue('');
    await page.getByRole('textbox', { name: 'Име', exact: true }).fill('Reload draft');
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Форми', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('textbox', { name: 'Име', exact: true })).toHaveValue('');
    await page.getByRole('textbox', { name: 'Име', exact: true }).fill('History draft');
    await page.getByRole('tab', { name: 'Текст и действия', exact: true }).click();
    await page.goBack();
    await expect(page.getByRole('textbox', { name: 'Име', exact: true })).toHaveValue('');
    expect(requests.operations.length).toBeGreaterThan(0);
    expect(requests.operations.every((operation) => operation === 'AdminStores')).toBe(true);
    expect(requests.external).toEqual([]);
  });

  test('state previews, retry, retained rows and confirmation preserve keyboard focus at 320px', async ({
    page,
    app,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const requests = businessRequests(page);
    await page.goto(app.url + catalogPath + '?tab=states');
    await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
    await choose(page, 'Preview state', 'Loading');
    await expect(page.getByRole('status')).toContainText('Loading example content');
    await expect(page.locator('.catalog-preview')).toHaveAttribute('aria-busy', 'true');
    await choose(page, 'Preview state', 'Empty');
    await expect(page.getByText('No example records yet.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add example', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Content is available', exact: true }),
    ).toBeVisible();
    await choose(page, 'Preview state', 'Error');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Content is available', exact: true }),
    ).toBeVisible();
    await choose(page, 'Preview state', 'Disabled');
    await expect(page.getByRole('button', { name: 'Primary action', exact: true })).toBeDisabled();
    await expect(page.getByText('Linen tote', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Retry refresh', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Example data refreshed locally.');
    const open = page.getByRole('button', { name: 'Open confirmation', exact: true });
    await open.focus();
    await open.press('Enter');
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(open).toBeFocused();
    await open.click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm example', exact: true })
      .click();
    await expect(open).toBeFocused();
    await expect(page.getByRole('status')).toContainText('Example action completed locally.');
    const tab = page.getByRole('tab', { name: 'Forms', exact: true });
    await tab.focus();
    await tab.press('Enter');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('complementary', { name: 'Settings and summary', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const toggle = page.getByRole('button', { name: 'Toggle navigation', exact: true });
    await toggle.click();
    const drawer = page.getByRole('complementary', { name: 'Navigation', exact: true });
    await expect(drawer).toBeVisible();
    const catalogLink = drawer.getByRole('link', { name: 'UI catalog', exact: true });
    await catalogLink.focus();
    await catalogLink.press('Enter');
    await expect(drawer).toHaveCount(0);
    await expect(page).toHaveURL(app.url + catalogPath);
    await expect(page.getByRole('tab', { name: 'Body and actions', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(requests.operations.every((operation) => operation === 'AdminStores')).toBe(true);
  });

  for (const width of [1280, 390, 320]) {
    test(`Sakai catalog Bulgarian light/dark composition at ${String(width)}px`, async ({
      page,
      app,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.goto(`${app.url}/bg/stores/${storeA}/ui-catalog`);
      const captures = join(workspaceRoot, '.references/review/phase-16');
      await mkdir(captures, { recursive: true });
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark')
          await page.getByRole('button', { name: 'Включи тъмна тема', exact: true }).click();
        for (const [section, label] of [
          ['body', 'Текст и действия'],
          ['lists', 'Списъци и менюта'],
          ['forms', 'Форми'],
          ['states', 'Състояния и обратна връзка'],
        ] as const) {
          const tab = page.getByRole('tab', { name: label, exact: true });
          await tab.click();
          await expect(tab).toHaveAttribute('aria-selected', 'true');
          await expect(
            page.locator(
              `holita-${section === 'body' ? 'body' : section === 'lists' ? 'list' : section === 'forms' ? 'form' : 'state'}-examples`,
            ),
          ).toBeVisible();
          await page.evaluate(async () => {
            await document.fonts.ready;
            window.scrollTo(0, 0);
          });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          ).toBe(true);
          expect(
            await page.locator('main > holita-ui-catalog > .card').evaluate((element) => ({
              font: getComputedStyle(element).fontFamily,
              padding: getComputedStyle(element).paddingTop,
            })),
          ).toMatchObject({ font: 'Lato, sans-serif', padding: '28px' });
          await page.screenshot({
            path: join(captures, `${section}-${String(width)}-${theme}.png`),
            fullPage: true,
            animations: 'disabled',
          });
          if (section === 'states') {
            await choose(page, 'Състояние на примера', 'Грешка');
            await page
              .getByRole('button', { name: 'Отваряне на потвърждение', exact: true })
              .click();
            await expect(
              page.getByRole('dialog', { name: 'Потвърждение', exact: true }),
            ).toBeVisible();
            await page.evaluate(() => {
              window.scrollTo(0, 0);
            });
            await page.screenshot({
              path: join(captures, `confirmation-${String(width)}-${theme}.png`),
              fullPage: true,
              animations: 'disabled',
            });
            await page.keyboard.press('Escape');
          }
        }
      }
      expect(errors).toEqual([]);
    });
  }
});

test.describe('Real catalog boundary', () => {
  test.use({ dataSource: 'graphql' });
  test('rejects direct catalog routes without loading the examples or requesting a CRUD resource', async ({
    page,
    app,
  }) => {
    const requests = businessRequests(page);
    const chunks: string[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('.js')) chunks.push(response.url());
    });
    await page.goto(app.url + catalogPath + '?tab=forms');
    await expect(page.getByRole('heading', { name: 'Stores', exact: true })).toBeVisible();
    await expect(page.locator('holita-ui-catalog')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'UI catalog', exact: true })).toHaveCount(0);
    expect(requests.operations.length).toBeGreaterThan(0);
    expect(requests.operations.every((name) => name === 'AdminStores')).toBe(true);
    // The rejected route never requests the lazy component; source content is not fetched.
    for (const url of chunks) {
      const response = await page.request.get(url);
      expect(await response.text()).not.toContain('holita-form-examples');
    }
  });
});
