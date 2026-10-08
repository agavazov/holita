import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chooseStore, test } from './angular-fixture.mjs';
import {
  prototypeOperation,
  prototypeStore,
  prototypeEvent,
  createdId,
  confirmPrototype,
} from './angular-prototype-fixture.mjs';

test.use({ dataSource: 'mock', referenceEnabled: false });
const bytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABgAAAAQCAIAAACDRijCAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAIElEQVQ4jWMwjLtAFcQwapDhaBgZjqajuNEsEkd+OgAAcGAOn5aBl0EAAAAASUVORK5CYII=',
  'base64',
);
function gallery(page: Page) {
  return page.getByRole('region', { name: 'Event gallery', exact: true });
}
function image(page: Page, name: string) {
  return gallery(page).getByRole('article', { name: `Image ${name}`, exact: true });
}
async function editor(page: Page, url: string): Promise<string> {
  await page.goto(url + '/en');
  await expect(page.getByRole('link', { name: 'holita Sofia', exact: true })).toBeVisible();
  const eventId = createdId(
    await prototypeOperation(page, 'AdminCreateEvent', {
      input: {
        title: 'Prototype gallery',
        code: 'GALLERY',
        format: 'ONLINE',
        meetingUrl: 'https://example.com/forum',
        startsAt: '2026-11-12T08:00:00Z',
        endsAt: '2026-11-12T16:00:00Z',
      },
    }),
    'createReferenceEvent',
  );
  await page.goto(
    `${url}/en/stores/${prototypeStore}/reference/events/${eventId}/edit?keep=yes#main-content`,
  );
  await expect(gallery(page).getByRole('button', { name: 'Add image', exact: true })).toBeEnabled();
  return eventId;
}
async function upload(page: Page, name: string): Promise<void> {
  await gallery(page)
    .locator('input[type=file]')
    .setInputFiles({ name, mimeType: 'image/png', buffer: bytes });
  await expect(image(page, name)).toBeVisible();
  await expect(gallery(page).getByRole('button', { name: 'Add image', exact: true })).toBeEnabled();
}
async function imageKeys(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('holita.admin.prototype.media', 1);
        request.onerror = () => {
          reject(new Error('Cannot open test image database.'));
        };
        request.onsuccess = () => {
          const database = request.result;
          const read = database
            .transaction('images', 'readonly')
            .objectStore('images')
            .getAllKeys();
          read.onsuccess = () => {
            resolve(read.result);
            database.close();
          };
          read.onerror = () => {
            reject(new Error('Cannot read image keys.'));
            database.close();
          };
        };
      }),
  );
}

test('Prototype decodes JPEG and WebP, persists their bytes and rejects a truncated PNG without adding History', async ({
  page,
  app,
}) => {
  const eventId = await editor(page, app.url);
  const files = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable.');
    context.fillStyle = '#315ed0';
    context.fillRect(0, 0, 24, 16);
    return ['image/jpeg', 'image/webp'].map((type) => ({
      type,
      data: canvas.toDataURL(type).split(',')[1] ?? '',
    }));
  });
  for (const [index, file] of files.entries()) {
    const name = `decoded-${String(index)}`;
    await gallery(page)
      .locator('input[type=file]')
      .setInputFiles({
        name,
        mimeType: file.type,
        buffer: Buffer.from(file.data, 'base64'),
      });
    await expect(image(page, name)).toBeVisible();
    await expect(
      gallery(page).getByRole('button', { name: 'Add image', exact: true }),
    ).toBeEnabled();
  }
  const before = await prototypeOperation(page, 'AdminEventHistory', {
    eventId,
    offset: 0,
    limit: 20,
  });
  await gallery(page)
    .locator('input[type=file]')
    .setInputFiles({
      name: 'truncated.png',
      mimeType: 'image/png',
      buffer: bytes.subarray(0, bytes.length - 4),
    });
  await expect(gallery(page).getByRole('alert')).toContainText('valid still JPEG, PNG or WebP');
  await expect(gallery(page).getByRole('article')).toHaveCount(2);
  expect(
    await prototypeOperation(page, 'AdminEventHistory', { eventId, offset: 0, limit: 20 }),
  ).toEqual(before);
  expect(await imageKeys(page)).toHaveLength(2);
  await page.reload();
  for (const index of [0, 1]) {
    const img = image(page, `decoded-${String(index)}`).locator('img');
    await expect(img).toBeVisible();
    await expect
      .poll(() =>
        img.evaluate(
          (element) =>
            element instanceof HTMLImageElement && element.complete && element.naturalWidth === 24,
        ),
      )
      .toBe(true);
  }
});
test('gallery saves bytes, alt null clearing, cover/order/removal and History independently from dirty Event fields', async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const eventId = await editor(page, app.url);
  await page.locator('#event-title').fill('My unsaved Event title');
  await upload(page, 'first.png');
  await upload(page, 'second.png');
  await expect(page.locator('#event-title')).toHaveValue('My unsaved Event title');
  await expect(image(page, 'first.png').getByText('Cover', { exact: true })).toBeVisible();
  await image(page, 'second.png').getByRole('button', { name: 'Alt text', exact: true }).click();
  const alt = page.getByRole('dialog', { name: 'Alt text', exact: true });
  await alt
    .getByRole('textbox', { name: 'Alt text', exact: true })
    .fill(' A blue conference hall ');
  await alt.getByRole('button', { name: 'Save alt text', exact: true }).click();
  await expect(alt).toHaveCount(0);
  await image(page, 'second.png').getByRole('button', { name: 'Set cover', exact: true }).click();
  await expect(image(page, 'second.png').getByText('Cover', { exact: true })).toBeVisible();
  await gallery(page).getByRole('button', { name: 'Move second.png earlier', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save event', exact: true })).toBeDisabled();
  await gallery(page).getByRole('button', { name: 'Save image order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save event', exact: true })).toBeEnabled();
  await expect(gallery(page).getByRole('article').first()).toHaveAttribute(
    'aria-label',
    'Image second.png',
  );
  const trigger = image(page, 'second.png').getByRole('button', {
    name: 'Preview second.png',
    exact: true,
  });
  await trigger.click();
  await expect(
    page
      .getByRole('dialog', { name: 'second.png', exact: true })
      .getByRole('img', { name: 'A blue conference hall', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'first.png', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await image(page, 'second.png').getByRole('button', { name: 'Alt text', exact: true }).click();
  await alt.getByRole('textbox', { name: 'Alt text', exact: true }).fill(' ');
  await alt.getByRole('button', { name: 'Save alt text', exact: true }).click();
  await expect(alt).toHaveCount(0);
  await expect(
    image(page, 'second.png').getByRole('img', { name: 'second.png', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(eventId + '\\?'));
  await expect(gallery(page).getByRole('article')).toHaveCount(2);
  await page.reload();
  await expect(gallery(page).getByRole('article').first()).toHaveAttribute(
    'aria-label',
    'Image second.png',
  );
  const saved = image(page, 'second.png').getByRole('img');
  await expect
    .poll(() =>
      saved.evaluate(
        (element) => element instanceof HTMLImageElement && element.naturalWidth === 24,
      ),
    )
    .toBe(true);
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Gallery reordered', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Edit event', exact: true }).click();
  const removal = image(page, 'second.png').getByRole('button', { name: 'Remove', exact: true });
  await removal.click();
  const dialog = page.getByRole('dialog', { name: 'Remove image', exact: true });
  await page.keyboard.press('Escape');
  await expect(removal).toBeFocused();
  await removal.click();
  await dialog.getByRole('button', { name: 'Remove image', exact: true }).click();
  await expect(image(page, 'second.png')).toHaveCount(0);
  await expect(image(page, 'first.png').getByText('Cover', { exact: true })).toBeVisible();
  await page.reload();
  await expect(gallery(page).getByRole('article')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('native IndexedDB failure leaves metadata and History untouched; retry and Trash/Restore preserve bytes', async ({
  page,
  app,
}) => {
  const eventId = await editor(page, app.url);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new Error('Quota');
    };
  });
  await gallery(page)
    .locator('input[type=file]')
    .setInputFiles({ name: 'failed.png', mimeType: 'image/png', buffer: bytes });
  await expect(gallery(page).getByRole('alert')).toContainText('could not be saved or read');
  await expect(gallery(page).getByRole('article')).toHaveCount(0);
  expect(await imageKeys(page)).toEqual([]);
  // Reload restores the native writer and discards the failed ephemeral upload.
  await page.reload();
  await expect(gallery(page).getByRole('button', { name: 'Add image', exact: true })).toBeEnabled();
  await upload(page, 'saved.png');
  expect(await imageKeys(page)).toHaveLength(1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('link', { name: 'View Prototype gallery', exact: true }).click();
  await page.getByRole('button', { name: 'Move to Trash', exact: true }).click();
  await confirmPrototype(page, 'Move to Trash');
  await expect(gallery(page)).toHaveCount(0);
  expect(await prototypeOperation(page, 'AdminMedia', { eventId })).toHaveProperty('errors');
  expect(await imageKeys(page)).toHaveLength(1);
  await page.reload();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await confirmPrototype(page, 'Restore');
  await expect(image(page, 'saved.png')).toBeVisible();
  await expect
    .poll(() =>
      image(page, 'saved.png')
        .getByRole('img')
        .evaluate((element) => element instanceof HTMLImageElement && element.naturalWidth === 24),
    )
    .toBe(true);
});

test('Reset waits for retired finalization, removes stored bytes and cancels unfinished upload capabilities', async ({
  page,
  app,
}) => {
  await editor(page, app.url);
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      if (
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        body.operationName === 'AdminFinalizeUpload'
      ) {
        document.documentElement.dataset['heldFinalize'] = 'yes';
        await new Promise<void>((resolve) => {
          window.addEventListener(
            'holita-test-release',
            () => {
              resolve();
            },
            { once: true },
          );
        });
      }
      return response;
    };
  });
  await gallery(page)
    .locator('input[type=file]')
    .setInputFiles({ name: 'retired.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.locator('html')).toHaveAttribute('data-held-finalize', 'yes');
  await chooseStore(page, 'holita Plovdiv');
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Waiting for submitted changes');
  const reboot = page.waitForEvent('load');
  await page.evaluate(() => window.dispatchEvent(new Event('holita-test-release')));
  await reboot;
  await expect(page).toHaveURL(app.url + '/en');
  await expect(page.getByRole('link', { name: 'holita Sofia', exact: true })).toBeVisible();
  expect(await imageKeys(page)).toEqual([]);
  await page.goto(`${app.url}/en/stores/${prototypeStore}/reference/events/${prototypeEvent}/edit`);
  await expect(gallery(page).getByRole('article')).toHaveCount(2);
  await expect(gallery(page).getByRole('button', { name: 'Add image', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      if (
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        body.operationName === 'AdminUploadIntent'
      ) {
        document.documentElement.dataset['heldUpload'] = 'yes';
        await new Promise<void>((resolve) => {
          window.addEventListener(
            'holita-test-release-upload',
            () => {
              resolve();
            },
            { once: true },
          );
        });
      }
      return original(input, init);
    };
  });
  await gallery(page)
    .locator('input[type=file]')
    .setInputFiles({ name: 'unfinished.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.locator('html')).toHaveAttribute('data-held-upload', 'yes');
  await chooseStore(page, 'holita Plovdiv');
  await page.evaluate(() => window.dispatchEvent(new Event('holita-test-release-upload')));
  await chooseStore(page, 'holita Sofia');
  await page.getByRole('link', { name: 'View Conference forum', exact: true }).click();
  await expect(gallery(page).getByRole('article')).toHaveCount(2);
  await expect(image(page, 'unfinished.png')).toHaveCount(0);
});

for (const width of [1280, 390, 320])
  test(`Sakai Prototype Events, program, Gallery and dialogs fit Bulgarian light/dark at ${String(width)}px`, async ({
    page,
    app,
  }) => {
    const folder = '.references/review/phase-15';
    await mkdir(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      const base = `${app.url}/bg/stores/${prototypeStore}/reference/events`;
      for (const [name, suffix] of [
        ['events', ''],
        ['program', `/${prototypeEvent}?tab=sessions`],
        ['gallery', `/${prototypeEvent}/edit`],
      ] as const) {
        await page.goto(base + suffix);
        await expect(page.getByRole('banner').getByText('Прототип', { exact: true })).toBeVisible();
        if (name === 'events')
          await expect(page.locator('tbody tr').first().getByRole('link').first()).toBeVisible();
        if (name === 'program')
          await expect(
            page
              .getByRole('list', { name: 'Сесии на събитието', exact: true })
              .getByRole('listitem'),
          ).toHaveCount(3);
        if (name === 'gallery')
          await expect(
            page
              .getByRole('region', { name: 'Галерия на събитието', exact: true })
              .getByRole('article'),
          ).toHaveCount(2);
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
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const capture = `${String(width)}-${dark ? 'dark' : 'light'}`;
        await page.screenshot({
          path: join(folder, `${name}-${capture}.png`),
          fullPage: true,
          animations: 'disabled',
        });
        if (name === 'gallery') {
          await page
            .getByRole('region', { name: 'Галерия на събитието', exact: true })
            .getByRole('article')
            .first()
            .getByRole('button', { name: 'Алтернативен текст', exact: true })
            .click();
          await page.screenshot({
            path: join(folder, `alt-${capture}.png`),
            animations: 'disabled',
          });
          await page.keyboard.press('Escape');
        }
      }
    }
    expect(errors).toEqual([]);
  });
