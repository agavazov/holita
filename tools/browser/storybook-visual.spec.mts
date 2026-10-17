import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { expect, test as base } from '@playwright/test';
import { workspaceRoot } from '../graphql/contracts.mjs';

// Serves the built Storybook; run `npm run build:storybook:admin` first (test:visual:admin does).
const test = base.extend<{ storybook: string }>({
  storybook: async ({ browserName }, use) => {
    if (browserName !== 'chromium') throw new Error('Visual review uses Chromium.');
    const root = join(workspaceRoot, 'apps/admin/storybook-static');
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };
    const server = createServer((request, response) => {
      const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
      const path = resolve(root, '.' + decodeURIComponent(pathname));
      if (!path.startsWith(root + sep)) {
        response.writeHead(400);
        response.end();
        return;
      }
      readFile(path).then(
        (file) => {
          response.writeHead(200, {
            'content-type': types[extname(path)] ?? 'application/octet-stream',
          });
          response.end(file);
        },
        () => {
          response.writeHead(404);
          response.end();
        },
      );
    });
    await new Promise<void>((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolveListen);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing Storybook port.');
    await use(`http://127.0.0.1:${String(address.port)}`);
    await new Promise<void>((resolveClose) => {
      server.close(() => {
        resolveClose();
      });
    });
  },
});

const candidates = join(workspaceRoot, 'test-results/storybook-visual-candidates');

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

// The reviewed set: every routed screen state worth approving, plus a dark and an English subset.
const captures = [
  { id: 'screens-fleet-vehicles--default', theme: 'light', locale: 'bg' },
  { id: 'screens-fleet-vehicles--default', theme: 'dark', locale: 'bg' },
  { id: 'screens-fleet-vehicles--default', theme: 'light', locale: 'en' },
  { id: 'screens-fleet-vehicles--empty', theme: 'light', locale: 'bg' },
  { id: 'screens-fleet-vehicles--no-results', theme: 'light', locale: 'bg' },
  { id: 'screens-fleet-vehicles--load-error', theme: 'light', locale: 'bg' },
  { id: 'screens-fleet-vehicles--create', theme: 'light', locale: 'bg' },
  { id: 'screens-fleet-vehicles--edit', theme: 'light', locale: 'bg' },
] as const;

for (const capture of captures)
  for (const viewport of viewports)
    test(`${capture.id} ${capture.theme} ${capture.locale} ${viewport.name}`, async ({
      page,
      storybook,
    }) => {
      await page.clock.setFixedTime(new Date('2026-10-01T09:00:00Z'));
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(
        `${storybook}/iframe.html?id=${capture.id}&viewMode=story&globals=theme:${capture.theme};locale:${capture.locale}`,
      );
      await expect(page.locator('#storybook-root main')).toBeVisible();
      // Fixture answers settle when no answered request has been in flight for 400 ms.
      await page.waitForFunction(() => {
        const state = document.documentElement.dataset;
        return (
          state['fixtureInFlight'] === '0' &&
          performance.now() - Number(state['fixtureActivity']) > 400
        );
      });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const name = `${capture.id}--${capture.theme}--${capture.locale}--${viewport.name}.png`;
      // Every run keeps a reviewable candidate, including when no baseline was approved yet.
      const candidate = await page.screenshot({
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      });
      await mkdir(candidates, { recursive: true });
      await writeFile(join(candidates, name), candidate);
      await test.info().attach('candidate', { body: candidate, contentType: 'image/png' });
      await expect(page).toHaveScreenshot(name, { fullPage: true });
    });
