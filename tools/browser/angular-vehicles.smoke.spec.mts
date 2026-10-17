import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { chooseBranch, test } from './angular-fixture.mjs';
import { workspaceRoot } from '../graphql/contracts.mjs';

const branchA = '10000000-0000-4000-8000-000000000001';
const path = `/en/${branchA}/fleet/vehicles`;
test.describe('Vehicles', () => {
  test('creates, edits, clears notes, reloads, isolates A → B → A and confirms deletion', async ({
    page,
    app,
  }) => {
    await page.goto(app.url + path + '?search=CA1234');
    await page.getByRole('link', { name: 'Create vehicle', exact: true }).click();
    await expect(page.locator('holita-vehicle-editor form input')).toHaveCount(1);
    await expect(page.locator('holita-vehicle-editor form textarea')).toHaveCount(1);
    await page.getByRole('button', { name: 'Save vehicle', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'License Plate', exact: true })).toBeFocused();
    await page.getByRole('textbox', { name: 'License Plate', exact: true }).fill(' CA1234AB ');
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('First line\nSecond line');
    await page.getByRole('button', { name: 'Save vehicle', exact: true }).click();
    await expect(page.getByText('Vehicle saved.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(app.url + path + '?search=CA1234');
    await page.getByRole('link', { name: 'CA1234AB', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(
      'First line\nSecond line',
    );
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('');
    await page.getByRole('button', { name: 'Save vehicle', exact: true }).click();
    await expect(page).toHaveURL(app.url + path + '?search=CA1234');
    await page.reload();
    await page.getByRole('link', { name: 'CA1234AB', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('');
    await page.getByRole('link', { name: 'Back to vehicles', exact: true }).click();
    await chooseBranch(page, 'Sandbox');
    await expect(page).toHaveURL(/\/fleet\/vehicles$/);
    await expect(page.getByRole('link', { name: 'CA1234AB', exact: true })).toHaveCount(0);
    await chooseBranch(page, 'Discordia');
    await page.getByRole('button', { name: 'Delete CA1234AB', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Delete vehicles', exact: true });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await confirmation.getByRole('button', { name: 'Delete vehicles', exact: true }).click();
    await expect(page.getByText('Deleted vehicles: 1.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'CA1234AB', exact: true })).toHaveCount(0);
  });
  test('renders Bulgarian desktop/mobile forms and lists in both themes with long notes', async ({
    page,
    app,
  }) => {
    const captures = join(workspaceRoot, '.references/review/vehicles');
    await mkdir(captures, { recursive: true });
    const bgPath = path.replace('/en/', '/bg/');
    await page.goto(app.url + bgPath + '/new');
    await page.getByRole('textbox', { name: 'Регистрационен номер', exact: true }).fill('CB1234AB');
    await page
      .getByRole('textbox', { name: 'Бележки', exact: true })
      .fill('Бележки за автомобила. '.repeat(70));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const dark of [false, true]) {
        if (
          (await page
            .locator('html')
            .evaluate((element) => element.classList.contains('app-dark'))) !== dark
        )
          await page
            .getByRole('button', {
              name: dark ? 'Включи тъмна тема' : 'Включи светла тема',
              exact: true,
            })
            .click();
        await expect(page.getByRole('textbox', { name: 'Бележки', exact: true })).toHaveValue(
          'Бележки за автомобила. '.repeat(70),
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await page.screenshot({
          path: join(captures, `form-${String(width)}-${dark ? 'dark' : 'light'}.png`),
          fullPage: true,
        });
      }
    }
    await page.getByRole('button', { name: 'Запази автомобила', exact: true }).click();
    await expect(page.getByRole('link', { name: 'CB1234AB', exact: true })).toBeVisible();
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const dark of [false, true]) {
        if (
          (await page
            .locator('html')
            .evaluate((element) => element.classList.contains('app-dark'))) !== dark
        )
          await page
            .getByRole('button', {
              name: dark ? 'Включи тъмна тема' : 'Включи светла тема',
              exact: true,
            })
            .click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await page.screenshot({
          path: join(captures, `list-${String(width)}-${dark ? 'dark' : 'light'}.png`),
          fullPage: true,
        });
      }
    }
  });
});
