import { expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { workspaceRoot } from '../graphql/contracts.mjs';
import { chooseBranch, test } from './angular-fixture.mjs';
async function captures(page: Page, section: string) {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark']) {
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      if (section === 'users' && viewport.name === 'desktop') {
        await expect
          .poll(() =>
            page
              .locator('holita-users-page table')
              .evaluate(
                (node) =>
                  node.parentElement !== null && node.scrollWidth <= node.parentElement.clientWidth,
              ),
          )
          .toBe(true);
      }
      await page.screenshot({
        path: join(
          workspaceRoot,
          '.references/review',
          `karma-${section}-${viewport.name}-${theme}.png`,
        ),
        fullPage: true,
        animations: 'disabled',
      });
      await page
        .getByRole('button', {
          name: theme === 'light' ? 'Use dark theme' : 'Use light theme',
          exact: true,
        })
        .click();
    }
  }
}
test('pages all users, exposes eleven escaped fields and navigates account menus with URL/language persistence', async ({
  page,
  app,
}) => {
  const headers: Record<string, string>[] = [];
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && request.postData()?.includes('AdminKarmaUsers')) {
      headers.push(request.headers());
    }
  });
  await page.goto(`${app.url}/en/karma-client/users`);
  const rows = page.locator('holita-users-page tbody tr');
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText('fixture-000');
  const open = page.getByRole('button', { name: 'User details 71', exact: true });
  await open.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('dd')).toHaveCount(11);
  await expect(dialog.locator('dd')).toHaveText([
    '71',
    'fixture-000',
    '0',
    '—',
    '40',
    '<b>Fixture name</b>',
    '—',
    '0',
    'fixture-0@example.test',
    '12',
    '12, 0',
  ]);
  expect(await dialog.locator('dl b').count()).toBe(0);
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows.first()).toContainText('fixture-050');
  await expect(page).toHaveURL(/first=50/);
  await page.reload();
  await expect(rows.first()).toContainText('fixture-050');
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows).toHaveCount(20);
  await expect(rows.first()).toContainText('fixture-100');
  await page.getByRole('combobox', { name: 'Rows per page', exact: true }).click();
  await page.getByRole('option', { name: '25', exact: true }).click();
  await expect(rows).toHaveCount(20);
  await expect(page).toHaveURL(/size=25/);
  const reads = app.karma.requests.filter((r) => r.path === '/apiv2/users').length;
  await page.getByLabel('Search by ID or name', { exact: true }).fill('fixture-119@example.test');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('fixture-119');
  expect(app.karma.requests.filter((r) => r.path === '/apiv2/users')).toHaveLength(reads);
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('fixture-119');
  await page.getByRole('link', { name: 'Български', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Потребители', exact: true })).toBeVisible();
  await expect(rows.first()).toContainText('fixture-119');
  await page.getByRole('link', { name: 'Роли', exact: true }).click();
  await expect(page.locator('holita-roles-page tbody tr')).toHaveCount(5);
  await expect(page.getByRole('cell', { name: 'Viewer', exact: true })).toBeVisible();
  expect(
    headers.every(
      (h) => !('x-branch-id' in h) && h['authorization'] === `Bearer ${app.demoSession.token}`,
    ),
  ).toBe(true);
});
test('retains account rows on refresh failure, retries empty data and leaves Branch changes independent', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/karma-client/users`);
  const rows = page.locator('holita-users-page tbody tr');
  await expect(rows).toHaveCount(50);
  const before = app.karma.requests.filter((r) => r.path === '/apiv2/users').length;
  await chooseBranch(page, 'Sandbox');
  expect(app.karma.requests.filter((r) => r.path === '/apiv2/users')).toHaveLength(before);
  app.karma.setFailed(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Karma is unavailable');
  await expect(rows).toHaveCount(50);
  app.karma.setFailed(false);
  app.karma.setAccountsEmpty(true);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'No matching records.', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Roles', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'No matching records.', exact: true })).toBeVisible();
  app.karma.setAccountsEmpty(false);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('holita-roles-page tbody tr')).toHaveCount(5);
  app.karma.setFailed(true);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Karma is unavailable');
  await expect(page.getByRole('cell', { name: 'No matching records.', exact: true })).toHaveCount(
    0,
  );
});
for (const section of ['users', 'roles']) {
  test(`reviews ${section} desktop/mobile light/dark and user detail focus`, async ({
    page,
    app,
  }) => {
    await page.goto(`${app.url}/en/karma-client/${section}`);
    await expect(page.locator(`holita-${section}-page tbody tr`)).toHaveCount(
      section === 'users' ? 50 : 5,
    );
    await captures(page, section);
    if (section === 'users') {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const theme of ['light', 'dark']) {
        const open = page.getByRole('button', { name: 'User details 71', exact: true });
        await open.click();
        await expect(page.getByRole('dialog').locator('dd')).toHaveCount(11);
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);
        await page.screenshot({
          path: join(workspaceRoot, '.references/review', `karma-user-dialog-mobile-${theme}.png`),
          fullPage: false,
          animations: 'disabled',
        });
        await page.getByRole('dialog').locator('dd').last().scrollIntoViewIfNeeded();
        await expect(page.getByRole('dialog').locator('dd').last()).toBeVisible();
        await page.screenshot({
          path: join(
            workspaceRoot,
            '.references/review',
            `karma-user-dialog-mobile-${theme}-lower.png`,
          ),
          fullPage: false,
          animations: 'disabled',
        });
        await page.keyboard.press('Escape');
        await expect(open).toBeFocused();
        await page
          .getByRole('button', {
            name: theme === 'light' ? 'Use dark theme' : 'Use light theme',
            exact: true,
          })
          .click();
      }
    }
  });
}
