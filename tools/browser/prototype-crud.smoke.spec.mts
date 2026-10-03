import { expect } from '@playwright/test';
import { test } from './prototype-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const features = [
  {
    label: 'Product',
    section: 'products',
    initial: 'Woven rug',
    fields: [['SKU', 'PROTOTYPE-SKU']],
  },
  {
    label: 'Venue',
    section: 'reference/venues',
    initial: 'Coworking lounge',
    fields: [
      ['City', 'Sofia'],
      ['Country code', 'bg'],
      ['Description', 'Workshop and conference space.'],
      ['Address', '12 Example Street'],
    ],
  },
  {
    label: 'Speaker',
    section: 'reference/speakers',
    initial: 'Stefan Tsvetkov',
    fields: [
      ['Email', 'speaker@example.com'],
      ['Short biography', 'Practical experience in design.'],
    ],
  },
];

for (const feature of features) {
  const singular = feature.label.toLowerCase();
  test(`Prototype ${feature.label} uses the shared CRUD screen, persists changes and isolates stores`, async ({
    page,
    app,
  }, testInfo) => {
    const external: string[] = [];
    const errors: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(app.url)) external.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    const list = (store: string) => `${app.url}/stores/${store}/${feature.section}`;
    const name = `Prototype ${singular}`;
    await page.goto(list(storeA));
    await expect(page.getByLabel('Data source: Prototype', { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('link', { name: feature.initial, exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Create ${singular}`, exact: true }).click();
    await page.getByRole('button', { name: `Save ${singular}`, exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
    await page.getByLabel('Name', { exact: true }).fill(name);
    for (const field of feature.fields) {
      const [label, value] = field;
      if (!label || !value) throw new Error('Missing example field');
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await page.getByRole('button', { name: `Save ${singular}`, exact: true }).click();
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name);
    await page.getByLabel('Name', { exact: true }).fill(`${name} edited`);
    if (feature.label === 'Venue')
      await page.getByRole('spinbutton', { name: 'Capacity', exact: true }).fill('150');
    if (feature.label === 'Speaker') await page.getByLabel('Email', { exact: true }).fill('');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('complementary', { name: `${feature.label} settings`, exact: true }),
    ).toHaveCSS('position', 'static');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${singular}-prototype-mobile.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: `Save ${singular}`, exact: true }).click();
    await expect(page.getByRole('link', { name: `${name} edited`, exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Store', exact: true }).click();
    await page.getByRole('option', { name: 'holita Plovdiv', exact: true }).click();
    await expect(page).toHaveURL(list(storeB));
    await expect(page.getByRole('grid', { name: `${feature.label}s`, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: `${name} edited`, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: `Create ${singular}`, exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    for (const field of feature.fields) {
      const [label, value] = field;
      if (!label || !value) throw new Error('Missing example field');
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await page.getByRole('button', { name: `Save ${singular}`, exact: true }).click();
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: `Delete ${singular}?`, exact: true });
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await confirmation.getByRole('button', { name: `Delete ${singular}`, exact: true }).click();
    await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('grid', { name: `${feature.label}s`, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Store', exact: true }).click();
    await page.getByRole('option', { name: 'holita Sofia', exact: true }).click();
    await expect(page.getByRole('link', { name: `${name} edited`, exact: true })).toBeVisible();
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('Prototype Venues preserves referenced rows and reports partial batch deletion without a backend', async ({
  page,
  app,
}) => {
  const url = `${app.url}/stores/${storeA}/reference/venues?sort=name&order=asc`;
  await page.goto(url);
  for (const name of ['Conference center', 'Business club'])
    await page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name, exact: true }) })
      .getByRole('checkbox')
      .check();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Delete venues', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Conference center: Venue is still referenced by another record.',
  );
  await expect(dialog.getByRole('button', { name: 'Delete venue', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Business club', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Conference center', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Conference center', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Business club', exact: true })).toHaveCount(0);
});
