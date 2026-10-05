import { expect, type Page } from '@playwright/test';
import { test } from './prototype-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001',
  storeB = '10000000-0000-4000-8000-000000000002';
const eventId = '60000000-0000-4000-8000-000000000002',
  path = `/en/stores/${storeA}/reference/events/${eventId}`;
const buffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABgAAAAQCAIAAACDRijCAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAIElEQVQ4jWMwjLtAFcQwapDhaBgZjqajuNEsEkd+OgAAcGAOn5aBl0EAAAAASUVORK5CYII=',
  'base64',
);
async function editor(page: Page, origin: string) {
  await page.goto(`${origin}${path}/edit`);
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  return page.getByRole('region', { name: 'Event gallery', exact: true });
}
async function imageCount(page: Page) {
  return page.evaluate(async () => {
    return new Promise<number>((resolve, reject) => {
      const open = indexedDB.open('holita.prototype.media', 1);
      open.onerror = () => {
        reject(new Error('Image storage unavailable'));
      };
      open.onsuccess = () => {
        const database = open.result,
          count = database.transaction('images').objectStore('images').count();
        count.onerror = () => {
          database.close();
          reject(new Error('Image count unavailable'));
        };
        count.onsuccess = () => {
          database.close();
          resolve(count.result);
        };
      };
    });
  });
}

test('Prototype gallery uploads, persists bytes, previews, orders, changes cover, preserves drafts and removes images', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(app.url)) external.push(request.url());
  });
  const gallery = await editor(page, app.url),
    input = gallery.locator('input[type=file]');
  const description = page.getByRole('textbox', { name: 'Description', exact: true });
  await description.fill('A draft preserved while gallery changes save.');
  await input.setInputFiles({ name: 'first.png', mimeType: 'image/png', buffer });
  const first = gallery.getByLabel('Image first.png', { exact: true });
  await expect(first.getByText('Cover', { exact: true })).toBeVisible();
  await expect(gallery.getByRole('button', { name: 'Add image' })).toBeEnabled();
  await input.setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer });
  const second = gallery.getByLabel('Image second.png', { exact: true });
  await expect(second).toBeVisible();
  await expect(gallery.getByRole('button', { name: 'Add image' })).toBeEnabled();
  await expect(description).toHaveText('A draft preserved while gallery changes save.');
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
  await second.getByRole('button', { name: 'Preview second.png' }).click();
  await expect(page.getByRole('dialog', { name: 'second.png', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'first.png', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}${path}`);
  await page.reload();
  await expect(gallery.getByRole('article')).toHaveCount(2);
  const img = second.getByRole('img', { name: 'A blue conference hall' });
  await expect
    .poll(() =>
      img.evaluate(
        (element) =>
          element instanceof HTMLImageElement && element.complete && element.naturalWidth === 24,
      ),
    )
    .toBe(true);
  expect(await imageCount(page)).toBe(2);
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.getByText('Image added', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await expect(gallery).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('prototype-gallery-desktop.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: testInfo.outputPath('prototype-gallery-mobile.png'),
    fullPage: true,
  });
  await second.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('button', { name: 'Remove image', exact: true }).click();
  await expect(second).toHaveCount(0);
  await expect(first.getByText('Cover', { exact: true })).toBeVisible();
  expect(await imageCount(page)).toBe(1);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('Prototype fixture images load locally, Trash/Restore preserves uploads and Reset clears both stores and bytes', async ({
  page,
  app,
}) => {
  await page.goto(
    `${app.url}/en/stores/${storeA}/reference/events/60000000-0000-4000-8000-000000000001`,
  );
  const gallery = page.getByRole('region', { name: 'Event gallery', exact: true });
  await expect(gallery.getByRole('article')).toHaveCount(2);
  await expect
    .poll(() =>
      gallery
        .getByRole('img')
        .first()
        .evaluate((element) => element instanceof HTMLImageElement && element.naturalWidth > 0),
    )
    .toBe(true);
  await editor(page, app.url);
  await gallery
    .locator('input[type=file]')
    .setInputFiles({ name: 'keep.png', mimeType: 'image/png', buffer });
  await expect(gallery.getByLabel('Image keep.png', { exact: true })).toBeVisible();
  await page.goto(`${app.url}${path}`);
  const oldUrl = await gallery.getByRole('img').getAttribute('src');
  if (!oldUrl) throw new Error('Missing preview URL');
  await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
  await page.getByRole('button', { name: 'Move to trash', exact: true }).last().click();
  await expect(page).toHaveURL(/reference\/events$/);
  await page.goto(`${app.url}${path}`);
  await expect(page.getByRole('button', { name: 'Restore event', exact: true })).toBeVisible();
  expect(await page.evaluate(async (url) => (await fetch(url)).status, oldUrl)).toBe(404);
  await page.getByRole('button', { name: 'Restore event', exact: true }).click();
  await expect(gallery.getByLabel('Image keep.png', { exact: true })).toBeVisible();
  await page.goto(
    `${app.url}/en/stores/${storeB}/reference/events/60000000-0000-4000-8000-000000000102/edit`,
  );
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  await gallery
    .locator('input[type=file]')
    .setInputFiles({ name: 'other-store.png', mimeType: 'image/png', buffer });
  await expect(gallery.getByLabel('Image other-store.png', { exact: true })).toBeVisible();
  expect(await imageCount(page)).toBe(2);
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page.getByRole('button', { name: 'Reset data', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/`);
  expect(await imageCount(page)).toBe(0);
  await editor(page, app.url);
  await expect(page.getByText('No images yet', { exact: true })).toBeVisible();
});

test('Prototype cancel and store switching stop finalization during a delayed binary upload', async ({
  page,
  app,
}) => {
  const gallery = await editor(page, app.url);
  await page.evaluate(() => {
    Request.prototype.blob = async function () {
      if (this.url.includes('/__prototype/media/uploads/')) {
        document.documentElement.dataset.holitaUploadWaiting = 'true';
        await new Promise<void>((resolve) => {
          window.addEventListener(
            'holita-release-upload',
            () => {
              resolve();
            },
            { once: true },
          );
        });
      }
      return new Response(this.body, { headers: this.headers }).blob();
    };
  });
  const operations: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/__prototype/graphql')) operations.push(request.postData() ?? '');
  });
  try {
    await gallery
      .locator('input[type=file]')
      .setInputFiles({ name: 'cancel.png', mimeType: 'image/png', buffer });
    await expect(page.locator('html')).toHaveAttribute('data-holita-upload-waiting', 'true');
    await gallery.getByRole('button', { name: 'Cancel upload', exact: true }).click();
    await expect(gallery.getByRole('button', { name: 'Add image' })).toBeEnabled();
    await page.evaluate(() => {
      delete document.documentElement.dataset.holitaUploadWaiting;
      window.dispatchEvent(new Event('holita-release-upload'));
    });
    await gallery
      .locator('input[type=file]')
      .setInputFiles({ name: 'switch.png', mimeType: 'image/png', buffer });
    await expect(page.locator('html')).toHaveAttribute('data-holita-upload-waiting', 'true');
    await page.getByRole('combobox', { name: 'Store', exact: true }).press('ArrowDown');
    await page.getByRole('option', { name: 'holita Plovdiv', exact: true }).click();
    await expect(page).toHaveURL(/000000000002\/reference\/events$/);
    // The URL can change before React commits the new store and unmounts the editor.
    await expect(page.getByRole('button', { name: 'Create event', exact: true })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('holita-release-upload')));
    await editor(page, app.url);
    await expect(page.getByText('No images yet', { exact: true })).toBeVisible();
    expect(operations.some((operation) => operation.includes('FinalizeReferenceUpload'))).toBe(
      false,
    );
    expect(await imageCount(page)).toBe(0);
  } finally {
    await page.evaluate(() => window.dispatchEvent(new Event('holita-release-upload')));
  }
});

test('Prototype shows invalid image and IndexedDB write failures without adding rows or History', async ({
  page,
  app,
}) => {
  const gallery = await editor(page, app.url),
    input = gallery.locator('input[type=file]');
  await input.setInputFiles({
    name: 'invalid.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });
  await expect(gallery.getByRole('alert')).toContainText('could not be uploaded');
  await expect(gallery.getByRole('article')).toHaveCount(0);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    };
  });
  await input.setInputFiles({ name: 'quota.png', mimeType: 'image/png', buffer });
  await expect(gallery.getByRole('alert')).toContainText(
    'Prototype images could not be saved or read',
  );
  await expect(gallery.getByRole('article')).toHaveCount(0);
  expect(await imageCount(page)).toBe(0);
  await page.reload();
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  await expect(page.getByText('No images yet', { exact: true })).toBeVisible();
});

test('Prototype decodes JPEG and WebP uploads and refuses a truncated file', async ({
  page,
  app,
}) => {
  const gallery = await editor(page, app.url);
  const files = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#315ed0';
    context.fillRect(0, 0, 24, 16);
    return ['image/jpeg', 'image/webp'].map((type) => ({
      type,
      data: canvas.toDataURL(type).split(',')[1] ?? '',
    }));
  });
  for (const [index, file] of files.entries()) {
    await gallery.locator('input[type=file]').setInputFiles({
      name: `image-${String(index)}`,
      mimeType: file.type,
      buffer: Buffer.from(file.data, 'base64'),
    });
    await expect(gallery.getByLabel(`Image image-${String(index)}`, { exact: true })).toBeVisible();
    await expect(gallery.getByRole('button', { name: 'Add image' })).toBeEnabled();
  }
  await gallery.locator('input[type=file]').setInputFiles({
    name: 'truncated.png',
    mimeType: 'image/png',
    buffer: buffer.subarray(0, buffer.length - 4),
  });
  await expect(gallery.getByRole('alert')).toContainText('could not be uploaded');
  await expect(gallery.getByRole('article')).toHaveCount(2);
});

test('Prototype reports unavailable IndexedDB at startup without contacting a backend', async ({
  page,
  app,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('Storage blocked', 'SecurityError');
    };
  });
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(app.url)) external.push(request.url());
  });
  await page.goto(`${app.url}/en/`);
  await expect(page.getByRole('alert')).toContainText(
    'Prototype images could not be saved or read',
  );
  expect(external).toEqual([]);
});
