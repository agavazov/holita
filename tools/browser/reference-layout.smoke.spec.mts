import { expect } from '@playwright/test';
import { test } from './fixture.mjs';

const storeId = '10000000-0000-4000-8000-000000000001';
const eventId = '60000000-0000-4000-8000-000000000001';

test('compact navigation and scrollable tabs keep Event editing and dirty navigation usable', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${app.url}/en/stores/${storeId}/reference/events/${eventId}/edit`);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Sofia Creative Forum');
  for (const name of ['General', 'Schedule & location', 'Content & media']) {
    const tab = page.getByRole('tab', { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
  await expect(page.getByRole('region', { name: 'Event gallery' })).toBeVisible();
  const general = page.getByRole('tab', { name: 'General', exact: true });
  await general.click();
  await general.press('ArrowRight');
  const schedule = page.getByRole('tab', { name: /Schedule & location$/ });
  await expect(schedule).toBeFocused();
  await schedule.press('Enter');
  await expect(page.getByLabel('Starts at', { exact: true })).toBeVisible();
  await schedule.press('ArrowRight');
  const content = page.getByRole('tab', { name: /Content & media$/ });
  await expect(content).toBeFocused();
  await content.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('event-320.png'),
    fullPage: true,
    animations: 'disabled',
  });

  await general.click();
  await page.getByLabel('Title', { exact: true }).fill('Unsaved mobile title');
  await expect(page.getByRole('status')).toHaveText('Unsaved changes');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const navigation = page.getByRole('dialog', { name: 'Navigation' });
  await navigation.getByRole('menuitem', { name: 'Venues', exact: true }).click();
  await expect(navigation).toBeHidden();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved mobile title');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await navigation.getByRole('menuitem', { name: 'Venues', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/stores/${storeId}/reference/venues`);
  await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Events', exact: true }).click();
  await page.getByRole('button', { name: 'Actions for Sofia Creative Forum', exact: true }).click();
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.getByText('No changes recorded yet.', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('event-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});
