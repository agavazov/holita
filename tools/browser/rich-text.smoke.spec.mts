import { expect } from '@playwright/test';
import { test } from './fixture.mjs';

const store = '10000000-0000-4000-8000-000000000001';
const event = '60000000-0000-4000-8000-000000000001';
const path = `/en/stores/${store}/reference/events/${event}`;

test('rich text survives paste, formatting, save, reload and edit, and clears explicitly', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${app.url}${path}/edit`);
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Description', exact: true });
  await editor.fill('Welcome to the forum');
  await page.getByRole('combobox', { name: 'Text style' }).press('ArrowDown');
  await page.getByRole('option', { name: 'Heading 2', exact: true }).click();
  await expect(editor.locator('h2')).toHaveText('Welcome to the forum');
  await editor.press('Control+End');
  await editor.press('Enter');
  await page.getByRole('combobox', { name: 'Text style' }).press('ArrowDown');
  await page.getByRole('option', { name: 'Paragraph', exact: true }).click();
  await editor.evaluate((element) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData(
      'text/html',
      '<p><b>Discover</b> <i>new ideas</i>.</p><h3>Agenda</h3><ul><li><p>Workshop</p></li></ul><ol><li><p>Discussion</p></li></ol><p onclick="alert(1)">Read more<img src="x" onerror="alert(1)"></p><script>alert(1)</script>',
    );
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    );
  });
  await expect(editor.locator('strong')).toHaveText('Discover');
  await expect(editor.locator('img,script,[onclick]')).toHaveCount(0);
  await editor.press('Control+End');
  await editor.press('Home');
  await editor.press('Shift+End');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByLabel('Web address').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Apply link', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Web address')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Web address').fill('https://example.com/program');
  await page.getByRole('button', { name: 'Apply link', exact: true }).click();
  await expect(editor.getByRole('link')).toHaveAttribute('href', 'https://example.com/program');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}${path}`);
  const description = page.getByLabel('Event description');
  await expect(description.locator('h2')).toHaveText('Welcome to the forum');
  await expect(description.locator('h3')).toHaveText('Agenda');
  await expect(description.locator('em')).toHaveText('new ideas');
  await expect(description.locator('li')).toHaveCount(2);
  await expect(description.getByRole('link')).toHaveAttribute(
    'href',
    'https://example.com/program',
  );
  await page.reload();
  await expect(description.locator('strong')).toHaveText('Discover');
  await page.screenshot({
    path: testInfo.outputPath('event-description-desktop.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  await expect(editor.locator('h2')).toHaveText('Welcome to the forum');
  await expect(editor.getByRole('link')).toHaveAttribute('href', 'https://example.com/program');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(editor).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath('event-description-mobile.png'),
    fullPage: true,
  });
  await editor.fill('Unsaved changes');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(editor).toHaveText('Unsaved changes');
  await expect(page.getByRole('dialog')).toBeHidden();
  await editor.click();
  await editor.press('Control+a');
  await editor.press('Backspace');
  await expect(editor).toHaveText('');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}${path}`);
  await expect(page.getByRole('button', { name: 'Edit event', exact: true })).toBeVisible();
  await expect(description).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('oversized rich text stays editable and an in-flight save stays in its original store', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}${path}/edit`);
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Description', exact: true });
  await editor.fill('я'.repeat(51200));
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Content & media', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(
    page.getByText('Keep the description within 100 KiB.', { exact: true }),
  ).toBeVisible();
  await expect(editor).toBeFocused();
  await editor.fill('Saved for Sofia');
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started: (() => void) | undefined;
  const captured = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route(app.gatewayUrl, async (route) => {
    const body: unknown = route.request().postDataJSON();
    if (
      typeof body === 'object' &&
      body !== null &&
      'operationName' in body &&
      body.operationName === 'UpdateReferenceEvent'
    ) {
      const response = await route.fetch();
      started?.();
      await pending;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await captured;
    await expect(editor).toHaveAttribute('contenteditable', 'false');
    await expect(page.getByRole('button', { name: 'Bold', exact: true })).toBeDisabled();
    await page.getByRole('combobox', { name: 'Store', exact: true }).press('ArrowDown');
    await page.getByRole('option', { name: 'holita Plovdiv', exact: true }).click();
    await expect(page).toHaveURL(/000000000002\/reference\/events$/);
    // React Router updates the URL before committing the new store subtree.
    await expect(page.getByRole('button', { name: 'Create event', exact: true })).toBeVisible();
    const completed = page.waitForResponse(
      (response) =>
        response.url() === app.gatewayUrl &&
        response.request().postData()?.includes('UpdateReferenceEvent') === true,
    );
    release?.();
    await completed;
    await expect(page.getByText('Event saved.', { exact: true })).toHaveCount(0);
  } finally {
    release?.();
  }
  const response = await page.request.post(app.gatewayUrl, {
    headers: { 'x-store-id': store },
    data: {
      query: 'query($id:ID!){referenceEvent(id:$id){descriptionHtml}}',
      variables: { id: event },
    },
  });
  const result: unknown = await response.json();
  await expect(page).toHaveURL(/000000000002\/reference\/events$/);
  expect(result).toMatchObject({
    data: { referenceEvent: { descriptionHtml: '<p>Saved for Sofia</p>' } },
  });
});
