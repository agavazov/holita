import { expect } from '@playwright/test';
import { test } from './fixture.mjs';

test.use({ timezoneId: 'America/New_York' });
const storeId = '10000000-0000-4000-8000-000000000001';
const eventId = '60000000-0000-4000-8000-000000000001';

test('Sessions persist CRUD, speakers and explicit drag order through the gateway on desktop and mobile', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = `${app.url}/en/stores/${storeId}/reference/events/${eventId}?tab=sessions&list=%3Fq%3DSofia`;
  await page.goto(url);
  await expect(
    page.getByText("No sessions yet. Add the first session to build this event's program."),
  ).toBeVisible();
  for (const title of ['Opening keynote', 'Afternoon workshop']) {
    await page.getByRole('button', { name: 'Add session', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel(/^Summary/).fill(`A practical session: ${title}.`);
    await expect(page.getByLabel('Starts at', { exact: true })).toHaveValue('2026-11-12T10:00');
    await page.getByLabel('Ends at', { exact: true }).fill('2026-11-12T11:00');
    await page.getByLabel('Ends at', { exact: true }).press('Tab');
    await page.getByLabel(/^Room/).fill('Main hall');
    await page.getByRole('combobox', { name: /^Speakers/ }).press('ArrowDown');
    await page.getByRole('combobox', { name: /^Speakers/ }).fill('Alex');
    await page.getByRole('option', { name: 'Alex Marin', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).click();
    if (title === 'Opening keynote') {
      await page.getByLabel('Ends at', { exact: true }).fill('2026-11-12T20:00');
      await page.getByLabel('Ends at', { exact: true }).press('Tab');
      await page.getByRole('button', { name: 'Save session', exact: true }).click();
      await expect(page.getByText('Choose a time within the event.')).toBeVisible();
      await page.getByLabel('Ends at', { exact: true }).fill('2026-11-12T11:00');
      await page.getByLabel('Ends at', { exact: true }).press('Tab');
    }
    await page.getByRole('button', { name: 'Save session', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add session', exact: true })).toBeVisible();
    await expect(page.getByRole('listitem', { name: title, exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('list')).toBe('?q=Sofia');
  }
  const program = page.getByRole('list', { name: 'Event sessions' });
  const titles = () => program.getByRole('heading').allTextContents();
  await page
    .getByRole('listitem', { name: 'Afternoon workshop', exact: true })
    .dragTo(page.getByRole('listitem', { name: 'Opening keynote', exact: true }));
  await expect.poll(titles).toEqual(['Afternoon workshop', 'Opening keynote']);
  await expect(page.getByRole('button', { name: 'Save order', exact: true })).toBeEnabled();
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await expect.poll(titles).toEqual(['Opening keynote', 'Afternoon workshop']);
  await page.getByRole('button', { name: 'Move Afternoon workshop up', exact: true }).click();
  await page.getByRole('button', { name: 'Save order', exact: true }).click();
  await expect(page.getByText('Session order saved.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save order', exact: true })).toBeDisabled();
  await page.reload();
  await expect.poll(titles).toEqual(['Afternoon workshop', 'Opening keynote']);
  await page.screenshot({
    path: testInfo.outputPath('sessions-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('sessions-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Actions for Afternoon workshop', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Hands-on workshop');
  await page.screenshot({
    path: testInfo.outputPath('session-editor-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hands-on workshop', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await expect(page.getByText('Alex Marin', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  await page.getByRole('tab', { name: 'Schedule & location', exact: true }).click();
  await page.getByLabel('Ends at', { exact: true }).fill('2026-11-12T10:30');
  await page.getByLabel('Ends at', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.locator('.MuiFormHelperText-root.Mui-error')).toContainText(
    'End must include all existing sessions.',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.goto(url);
  await page.getByRole('button', { name: 'Actions for Hands-on workshop', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete session', exact: true }).click();
  await expect(page.getByRole('listitem', { name: 'Hands-on workshop', exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  await expect.poll(titles).toEqual(['Opening keynote']);
  expect(errors).toEqual([]);
});
