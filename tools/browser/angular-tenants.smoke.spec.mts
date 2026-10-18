import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from './angular-fixture.mjs';
import { workspaceRoot } from '../graphql/contracts.mjs';

test.use({ demoSignedIn: false });
const branchId = '10000000-0000-4000-8000-000000000001';
async function signIn(page: Page, name: string, branch = 'Discordia') {
  await page.getByRole('combobox', { name: 'Tenant', exact: true }).click();
  await page.getByRole('option', { name, exact: true }).click();
  await expect(page.getByTestId('demo-login')).toBeDisabled();
  await page.getByRole('combobox', { name: 'Branch', exact: true }).click();
  await page.getByRole('option', { name: branch, exact: true }).click();
  await page.getByTestId('demo-login').click();
}
test('real tenant login gates deep links, survives reload, clears on logout and isolates discovery', async ({
  page,
  app,
}) => {
  const business: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url() === app.gatewayUrl &&
      /Admin(Vehicles|Devices|Branches)/.test(request.postData() ?? '')
    )
      business.push(request.headers()['authorization'] ?? 'missing');
  });
  await page.goto(
    `${app.url}/en/10000000-0000-4000-8000-000000000002/fleet/devices/new?search=old`,
  );
  await expect(page.getByRole('heading', { name: 'Demo sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Tenant', exact: true })).toBeVisible();
  expect(business).toEqual([]);
  await expect(page.locator('holita-admin-shell')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Branch', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await signIn(page, 'RentalSofia');
  await expect(page).toHaveURL(`${app.url}/en/${branchId}/fleet/vehicles`);
  await expect(page.getByRole('heading', { name: 'Vehicles', exact: true })).toBeVisible();
  expect(business.length).toBeGreaterThan(0);
  expect(
    business.every((header) =>
      header.startsWith('Bearer holita-demo.01000000-0000-4000-8000-000000000001.'),
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vehicles', exact: true })).toBeVisible();
  await page.getByTestId('demo-logout').click();
  await expect(page.getByRole('heading', { name: 'Demo sign in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('holita.admin.demo-session'))).toBeNull();
  await signIn(page, 'Isolation tenant', 'Isolation branch');
  await expect(page.getByRole('combobox', { name: 'Branch', exact: true })).toContainText(
    'Isolation branch',
  );
  await expect(page.getByRole('heading', { name: 'Branches', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Vehicles', exact: true })).toBeVisible();
  expect(business.at(-1)).toContain('Bearer holita-demo.01000000-0000-4000-8000-000000000002.');
});

test('tenant login works by keyboard in Bulgarian narrow/light/dark layouts', async ({
  page,
  app,
}) => {
  const captures = join(workspaceRoot, '.references/review/tenants');
  await mkdir(captures, { recursive: true });
  await page.goto(`${app.url}/bg`);
  await expect(
    page.getByRole('heading', { name: 'Демонстрационен вход', exact: true }),
  ).toBeVisible();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('.login-container').evaluate(async (element) => {
      await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
    });
    for (const theme of ['light', 'dark']) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: join(captures, `login-${String(width)}-${theme}.png`),
        fullPage: true,
      });
      await page
        .getByRole('button', {
          name: theme === 'light' ? 'Включи тъмна тема' : 'Включи светла тема',
          exact: true,
        })
        .click();
    }
  }
  const select = page.getByRole('combobox', { name: 'Tenant', exact: true });
  await select.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  const branches = page.getByRole('combobox', { name: 'Клон', exact: true });
  await expect(branches).not.toHaveAttribute('aria-disabled', 'true');
  await branches.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.getByTestId('demo-login').click();
  await expect(page.getByRole('heading', { name: 'Автомобили', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Клони', exact: true })).toHaveCount(0);
  // At 320 px the navigation is a closed drawer, so no group headings are rendered.
  await expect(page.locator('aside nav').getByRole('heading')).toHaveCount(0);
});
