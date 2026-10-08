import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from './angular-fixture.mjs';
import { createdId, prototypeOperation } from './angular-prototype-fixture.mjs';
import { workspaceRoot } from '../graphql/contracts.mjs';

const storeId = '10000000-0000-4000-8000-000000000001';
const labels = {
  en: {
    products: 'Products',
    event: 'Create event',
    title: 'Title',
    dark: 'Use dark theme',
    invalid: 'Invalid product ID.',
    prototypeFailure: 'Prototype could not start.',
    configurationFailure: 'Could not start holita.',
  },
  bg: {
    products: 'Продукти',
    event: 'Ново събитие',
    title: 'Заглавие',
    dark: 'Включи тъмна тема',
    invalid: 'Невалиден идентификатор на продукт.',
    prototypeFailure: 'Прототипът не може да стартира.',
    configurationFailure: 'holita не може да стартира.',
  },
};

async function capture(page: Page, name: string): Promise<void> {
  await page.locator('.layout-main-container').evaluate(async (element) => {
    await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  expect(
    await page
      .locator('.card')
      .first()
      .evaluate((el) => ({
        font: getComputedStyle(el).fontFamily,
        padding: getComputedStyle(el).paddingTop,
      })),
  ).toEqual({ font: 'Lato, sans-serif', padding: '28px' });
  await page.screenshot({
    path: join(workspaceRoot, '.references/review/phase-17', name + '.png'),
    fullPage: true,
    animations: 'disabled',
  });
}

for (const mode of ['graphql', 'mock'] as const) {
  test.describe(`${mode} parity composition`, () => {
    test.use({ dataSource: mode });
    for (const language of ['en', 'bg'] as const) {
      test(`${language} populated list, retained editor draft and failure at desktop, mobile and 991/992px in both themes`, async ({
        page,
        app,
      }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('dialog', (dialog) => {
          void dialog.accept();
        });
        await mkdir(join(workspaceRoot, '.references/review/phase-17'), { recursive: true });
        const text = labels[language];
        const path = `${app.url}/${language}/stores/${storeId}`;
        for (const theme of ['light', 'dark']) {
          await page.setViewportSize({ width: 1280, height: 800 });
          await page.goto(path + '/products');
          await expect(
            page.getByRole('heading', { name: text.products, exact: true }),
          ).toBeVisible();
          await expect(page.locator('tbody tr').first().getByRole('checkbox')).toBeVisible();
          if (theme === 'dark')
            await page.getByRole('button', { name: text.dark, exact: true }).click();
          for (const width of [1280, 992, 991, 390, 320]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
            await expect(page.getByRole('combobox', { name: /^(Store|Магазин)$/ })).toHaveCount(1);
            await capture(page, `${mode}-${language}-list-${String(width)}-${theme}`);
          }
          await page.goto(path + '/reference/events/new');
          await expect(page.getByRole('heading', { name: text.event, exact: true })).toBeVisible();
          const title = page.getByRole('textbox', { name: text.title, exact: true });
          await title.fill('holita parity draft');
          await page.locator('#event-code').fill('PARITY-DRAFT');
          for (const width of [1280, 992, 991, 390, 320]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
            await expect(title).toHaveValue('holita parity draft');
            await capture(page, `${mode}-${language}-editor-${String(width)}-${theme}`);
          }
          await page.goto(path + '/products/invalid/edit');
          await expect(page.getByRole('alert')).toContainText(text.invalid);
          for (const width of [1280, 320]) {
            await page.setViewportSize({ width, height: 800 });
            await capture(page, `${mode}-${language}-failure-${String(width)}-${theme}`);
          }
        }
        expect(errors).toEqual([]);
      });
    }
  });
}

test.describe('Long Event labels', () => {
  test.use({ dataSource: 'mock' });
  test('valid unbroken Event titles and Tag names wrap within the overview and child editor in both themes', async ({
    page,
    app,
  }) => {
    const path = `${app.url}/en/stores/${storeId}/reference`;
    const title = 'LongEventTitle'.repeat(14);
    const tagName = 'T'.repeat(100);
    await page.goto(path + '/tags/new');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(tagName);
    await page.getByRole('button', { name: 'Save tag', exact: true }).click();
    const tagLink = page.getByRole('link', { name: tagName, exact: true });
    await expect(tagLink).toBeVisible();
    const tagId = (await tagLink.getAttribute('href'))?.split('/').at(-2);
    if (!tagId) throw new Error('Missing saved Tag ID.');
    const eventId = createdId(
      await prototypeOperation(page, 'AdminCreateEvent', {
        input: {
          title,
          code: 'LONG-TITLE',
          format: 'ONLINE',
          meetingUrl: 'https://example.com/meet',
          startsAt: '2026-11-12T08:00:00Z',
          endsAt: '2026-11-12T16:00:00Z',
          tagIds: [tagId],
        },
      }),
      'createReferenceEvent',
    );
    await page.goto(path + '/events/' + eventId);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('.overview-tag')).toHaveText(tagName);
    await mkdir(join(workspaceRoot, '.references/review/phase-17'), { recursive: true });
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 1280, height: 800 });
      if (theme === 'dark')
        await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
      for (const width of [1280, 992, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await capture(page, `long-event-labels-${String(width)}-${theme}`);
      }
    }
    await page.goto(path + '/events/' + eventId + '/sessions/new');
    await expect(page.getByRole('heading', { name: 'Add session', exact: true })).toBeVisible();
    await expect(page.locator('#session-title')).toBeVisible();
    await page.getByRole('button', { name: 'Use light theme', exact: true }).click();
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 1280, height: 800 });
      if (theme === 'dark')
        await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
      for (const width of [1280, 992, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await capture(page, `long-event-session-${String(width)}-${theme}`);
      }
    }
  });
});

test.describe('Accessible startup failures', () => {
  test.use({ dataSource: 'mock' });
  for (const language of ['en', 'bg'] as const) {
    test(`blocked IndexedDB reports a localized ${language} startup alert without a backend request`, async ({
      page,
      app,
    }) => {
      await page.addInitScript(() => {
        IDBFactory.prototype.open = () => {
          throw new DOMException('Storage blocked', 'SecurityError');
        };
      });
      const external: string[] = [];
      const operations: string[] = [];
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== new URL(app.url).origin) external.push(request.url());
        if (request.method() === 'POST') operations.push(request.url());
      });
      await page.goto(`${app.url}/${language}`);
      await expect(page.getByRole('alert')).toContainText(labels[language].prototypeFailure);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      expect(external).toEqual([]);
      expect(operations).toEqual([]);
    });
    test(`failed configuration reports a localized ${language} startup alert`, async ({
      page,
      app,
    }) => {
      await page.route('**/config.json', (route) =>
        route.fulfill({ status: 503, body: 'Unavailable' }),
      );
      await page.goto(`${app.url}/${language}`);
      await expect(page.getByRole('alert')).toContainText(labels[language].configurationFailure);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
    });
  }
});
