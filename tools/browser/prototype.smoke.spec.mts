import { expect } from '@playwright/test';
import { test } from './prototype-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const tagsPath = `/en/stores/${storeA}/reference/tags`;

test('Prototype uses the same Tags screens, persists CRUD, isolates stores and resets dirty editors', async ({
  page,
  app,
}) => {
  test.setTimeout(90000);
  async function waitForTags() {
    const grid = page.getByRole('grid', { name: 'Tags', exact: true });
    await expect(grid).toBeVisible({ timeout: 20000 });
    await expect(grid.getByRole('progressbar')).toHaveCount(0, { timeout: 20000 });
  }
  const errors: string[] = [],
    externalRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(app.url)) externalRequests.push(request.url());
  });
  await page.goto(`${app.url}/en/`);
  await expect(page.getByLabel('Data source: Prototype', { exact: true })).toBeVisible();
  await expect(page.getByText(/^holita · \d{4}$/)).toHaveCount(0);
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
  await page.getByRole('button', { name: 'holita Sofia', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}${tagsPath}`);
  await waitForTags();
  await expect(page.getByRole('menuitem', { name: 'Tags', exact: true })).toBeVisible();
  for (const name of ['Products', 'Events', 'Venues', 'Speakers', 'UI catalog'])
    await expect(page.getByRole('menuitem', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create tag', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Prototype workshop');
  await page.getByLabel('Color', { exact: true }).fill('#ABCDEF');
  await page.getByRole('button', { name: 'Save tag', exact: true }).click();
  await waitForTags();
  const link = page.getByRole('link', { name: 'Prototype workshop', exact: true });
  await expect(link).toBeVisible();
  await page.reload();
  await waitForTags();
  await expect(link).toBeVisible();
  await link.click();
  await page.getByLabel('Name', { exact: true }).fill('Prototype edited');
  await page.getByRole('button', { name: 'Save tag', exact: true }).click();
  await waitForTags();
  await expect(page.getByRole('link', { name: 'Prototype edited', exact: true })).toBeVisible();
  await page.goto(`${app.url}/en/stores/${storeB}/reference/tags`);
  await waitForTags();
  await expect(page.getByRole('link', { name: 'Prototype edited', exact: true })).toHaveCount(0);
  await page.goto(`${app.url}${tagsPath}`);
  await waitForTags();
  await page.getByRole('link', { name: 'Prototype edited', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Unsaved name');
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unsaved name');
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page.getByRole('button', { name: 'Reset data', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/`);
  await page.getByRole('button', { name: 'holita Sofia', exact: true }).click();
  await waitForTags();
  await expect(page.getByRole('link', { name: 'Prototype edited', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sport', exact: true })).toBeVisible();
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('Prototype blocks unmapped screens and keeps navigation usable at 320 px', async ({
  page,
  app,
}, testInfo) => {
  const operations: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/__prototype/graphql'))
      operations.push(request.postData() ?? request.url());
  });
  await page.goto(`${app.url}/en/stores/${storeA}/reference/unmapped`);
  await expect(
    page.getByText('This section is not available in Prototype yet.', { exact: true }),
  ).toBeVisible();
  expect(operations.some((operation) => operation.includes('ListReferenceEvents'))).toBe(false);
  await page.getByRole('button', { name: 'Open tags', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}${tagsPath}`);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('menuitem', { name: 'Tags', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Navigation' })
    .getByRole('menuitem', { name: 'Tags', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Reset demo data', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sport', exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('prototype-320.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

for (const [language, message] of [
  ['en', 'Admin could not start. Reload and try again.'],
  ['bg', 'Панелът не можа да се стартира. Презареди страницата и опитай отново.'],
] as const) {
  test(`Prototype replaces corrupt saved data and reports unavailable browser storage in ${language}`, async ({
    page,
    app,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('holita.prototype.data', '{bad data');
    });
    await page.goto(`${app.url}/${language}/stores/${storeA}/reference/tags`);
    await expect(page.getByRole('link', { name: 'Sport', exact: true })).toBeVisible();
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error('Storage blocked');
      };
    });
    await page.reload();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(message);
    await expect(alert).toContainText('Prototype requires browser storage. Enable it and reload.');
    await expect(page.locator('html')).toHaveAttribute('lang', language);
  });
}
