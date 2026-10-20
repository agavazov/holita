import { expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { workspaceRoot } from '../graphql/contracts.mjs';
import { chooseBranch, chooseLanguage, setDarkTheme, test } from './angular-fixture.mjs';
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
      if (process.env.HOLITA_BROWSER_SCREENSHOTS === '1') {
        await page.screenshot({
          path: join(
            workspaceRoot,
            '.references/review',
            `karma-${section}-${viewport.name}-${theme}.png`,
          ),
          fullPage: true,
          animations: 'disabled',
        });
      }
      await setDarkTheme(page, theme === 'light');
    }
  }
}
test('pages trips from truck details, restores cursor history and exposes all 23 values with focus restoration', async ({
  page,
  app,
}) => {
  const headers: Record<string, string>[] = [];
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && request.postData()?.includes('AdminKarmaTrips')) {
      headers.push(request.headers());
    }
  });
  await page.goto(`${app.url}/en/karma-client/cars/41`);
  await page.getByRole('link', { name: 'Trips', exact: true }).click();
  const rows = page.locator('holita-trips-page section tbody tr');
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText('4000000120');
  const view = rows.first().getByRole('button', { name: 'View 4000000120', exact: true });
  await view.click();
  const dialog = page.getByRole('dialog', { name: 'Trip details', exact: true });
  await expect(dialog.locator('dd')).toHaveCount(23);
  await expect(dialog).toContainText('stop_date');
  await expect(dialog).toContainText('—');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(view).toBeFocused();
  await page.getByRole('button', { name: 'Older', exact: true }).click();
  await expect(rows.first()).toContainText('4000000070');
  await page.reload();
  await expect(rows.first()).toContainText('4000000070');
  await page.getByRole('button', { name: 'Older', exact: true }).click();
  await expect(rows).toHaveCount(20);
  await expect(rows.first()).toContainText('4000000020');
  await expect(page.getByRole('button', { name: 'Older', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Newer', exact: true }).click();
  await expect(rows.first()).toContainText('4000000070');
  await page.goBack();
  await expect(rows.first()).toContainText('4000000020');
  const before = headers.length;
  await chooseBranch(page, 'Sandbox');
  expect(headers).toHaveLength(before);
  await chooseLanguage(page, 'Български');
  await expect(page.getByRole('heading', { name: 'Пътувания', exact: true })).toBeVisible();
  await expect(rows.first()).toContainText('4000000020');
  await page.getByRole('button', { name: 'Последни', exact: true }).click();
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText('4000000120');
  expect(
    headers.every(
      (header) =>
        !('x-branch-id' in header) && header['authorization'] === `Bearer ${app.demoSession.token}`,
    ),
  ).toBe(true);
});
test('walks 600 events and filters UTC dates/code zero and changes page size without losing raw values', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/karma-client/cars/41/events`);
  const rows = page.locator('holita-events-page section tbody tr'),
    seen = new Set<string>();
  for (let index = 0; index < 12; index++) {
    await expect(rows.first()).toContainText(String(3000000600 - index * 50));
    await expect(rows).toHaveCount(50);
    for (const id of await rows.locator('td:nth-child(2)').allTextContents()) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
    if (index < 11) {
      await page.getByRole('button', { name: 'Older', exact: true }).click();
    }
  }
  expect(seen.size).toBe(600);
  await expect(page.getByRole('button', { name: 'Older', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Records per page', exact: true }).click();
  await page.getByRole('option', { name: '25', exact: true }).click();
  await page.getByLabel('From (UTC)', { exact: true }).fill('2026-01-01T00:01');
  await page.getByLabel('To (UTC)', { exact: true }).fill('2026-01-01T00:01');
  await page.getByLabel('Event codes', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('3000000002');
  expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
  const view = rows.first().getByRole('button', { name: 'View 3000000002', exact: true });
  await view.click();
  const dialog = page.getByRole('dialog', { name: 'Event details', exact: true });
  await expect(dialog.locator('dd')).toHaveCount(12);
  await expect(dialog).toContainText('<b>Fixture event text</b>');
  await expect(dialog.locator('dl b')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(view).toBeFocused();
  await page.reload();
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(rows).toHaveCount(50);
});
test('extends the profile period and retains data on failed refresh with retry and honest empty/missing states', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/karma-client/cars/41/driving-profile`);
  const rows = page.locator('holita-driving-profile-page tbody tr');
  await expect(rows).toHaveCount(9);
  await expect(rows.first()).toContainText('—');
  await expect(rows.nth(1)).toContainText('0');
  const from = await page.getByLabel('From (API time)', { exact: true }).inputValue(),
    to = await page.getByLabel('To (API time)', { exact: true }).inputValue();
  expect(new Date(to + 'Z').getTime() - new Date(from + 'Z').getTime()).toBe(7 * 86400000);
  await page.getByLabel('From (API time)', { exact: true }).fill('2026-01-01T00:00');
  await page.getByLabel('To (API time)', { exact: true }).fill('2026-02-01T00:00');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/from=2026/);
  await expect(rows).toHaveCount(9);
  await page.reload();
  await expect(page.getByLabel('From (API time)', { exact: true })).toHaveValue('2026-01-01T00:00');
  await expect(rows).toHaveCount(9);
  app.karma.setFailed(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Karma is unavailable');
  await expect(rows).toHaveCount(9);
  app.karma.setFailed(false);
  app.karma.setHistoryEmpty(true);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('No data for these filters');
  await page.goto(`${app.url}/en/karma-client/cars/999/driving-profile`);
  await expect(page.getByRole('alert')).toContainText('Truck not found');
});
for (const section of ['trips', 'events', 'driving-profile']) {
  test(`reviews ${section} on desktop/mobile in light/dark themes and validates keyboard details`, async ({
    page,
    app,
  }) => {
    await page.goto(`${app.url}/en/karma-client/cars/41/${section}`);
    const rows = page.locator(`holita-${section}-page section tbody tr`);
    await expect(rows).toHaveCount(section === 'driving-profile' ? 9 : 50);
    await captures(page, section);
    if (section !== 'driving-profile') {
      const button = rows.first().getByRole('button');
      await button.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('dd')).toHaveCount(section === 'trips' ? 23 : 12);
      if (process.env.HOLITA_BROWSER_SCREENSHOTS === '1') {
        await page.screenshot({
          path: join(workspaceRoot, '.references/review', `karma-${section}-mobile-details.png`),
          animations: 'disabled',
        });
      }
      await page.keyboard.press('Escape');
      await expect(button).toBeFocused();
    }
  });
}
