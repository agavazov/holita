import { expect } from '@playwright/test';
import { test } from './fixture.mjs';

const store = '10000000-0000-4000-8000-000000000001';
const event = '60000000-0000-4000-8000-000000000001';
const path = `/stores/${store}/reference/events/${event}`;
const buffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABgAAAAQCAIAAACDRijCAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAIElEQVQ4jWMwjLtAFcQwapDhaBgZjqajuNEsEkd+OgAAcGAOn5aBl0EAAAAASUVORK5CYII=',
  'base64',
);

test('gallery saves independently, preserves text drafts, previews, orders, changes cover and removes images', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${app.url}${path}/edit`);
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  const description = page.getByRole('textbox', { name: 'Description', exact: true });
  await description.fill('A description kept while editing the gallery.');
  const gallery = page.getByRole('region', { name: 'Event gallery', exact: true });
  const input = gallery.locator('input[type=file]');
  await input.setInputFiles({ name: 'first.png', mimeType: 'image/png', buffer });
  const first = gallery.getByLabel('Image first.png', { exact: true });
  await expect(first.getByText('Cover', { exact: true })).toBeVisible();
  await expect(gallery.getByRole('button', { name: 'Add image' })).toBeEnabled();
  await input.setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer });
  const second = gallery.getByLabel('Image second.png', { exact: true });
  await expect(second).toBeVisible();
  await expect(gallery.getByRole('button', { name: 'Add image' })).toBeEnabled();
  await expect(description).toHaveText('A description kept while editing the gallery.');
  await second.getByRole('button', { name: 'Alt text', exact: true }).click();
  await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('A blue conference hall');
  await page.getByRole('button', { name: 'Save alt text', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await second.getByRole('button', { name: 'Set cover', exact: true }).click();
  await expect(second.getByText('Cover', { exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Move first.png later' }).click();
  await expect(page.getByRole('button', { name: 'Save event', exact: true })).toBeDisabled();
  await gallery.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await expect(gallery.getByRole('article').first()).toHaveAttribute(
    'aria-label',
    'Image first.png',
  );
  await first.getByRole('button', { name: 'Move first.png later' }).click();
  await gallery.getByRole('button', { name: 'Save order', exact: true }).click();
  await expect(gallery.getByRole('button', { name: 'Save order', exact: true })).toHaveCount(0);
  await expect(gallery.getByRole('article').first()).toHaveAttribute(
    'aria-label',
    'Image second.png',
  );
  await expect(second.getByRole('img', { name: 'A blue conference hall' })).toBeVisible();
  await second.getByRole('button', { name: 'Preview second.png' }).click();
  const preview = page.getByRole('dialog', { name: 'second.png', exact: true });
  await expect(preview.getByRole('img', { name: 'A blue conference hall' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'first.png', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}${path}`);
  await expect(page.getByLabel('Event description')).toHaveText(
    'A description kept while editing the gallery.',
  );
  await page.reload();
  await expect(gallery.getByRole('article')).toHaveCount(2);
  await expect(gallery.getByRole('article').first()).toHaveAttribute(
    'aria-label',
    'Image second.png',
  );
  await page.screenshot({ path: testInfo.outputPath('event-gallery-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath('event-gallery-mobile.png'), fullPage: true });
  await second.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('button', { name: 'Remove image', exact: true }).click();
  await expect(second).toHaveCount(0);
  await expect(first.getByText('Cover', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('switching stores cancels an upload before finalization and suppresses late feedback', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}${path}/edit`);
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  let release: (() => void) | undefined, started: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const captured = new Promise<void>((resolve) => {
    started = resolve;
  });
  let finalizations = 0;
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && request.postData()?.includes('FinalizeReferenceUpload'))
      finalizations++;
  });
  await page.route('**/media/uploads/*', async (route) => {
    const response = await route.fetch();
    started?.();
    await pending;
    await route.fulfill({ response });
  });
  try {
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'cancelled.png', mimeType: 'image/png', buffer });
    await captured;
    await page.getByRole('combobox', { name: 'Store', exact: true }).press('ArrowDown');
    await page.getByRole('option', { name: 'holita Plovdiv', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create event', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/000000000002\/reference\/events$/);
    release?.();
    await page.goto(`${app.url}${path}/edit`);
    await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
    await expect(page.getByText('No images yet', { exact: true })).toBeVisible();
    expect(finalizations).toBe(0);
  } finally {
    release?.();
  }
});
