import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { expect, test as base } from '@playwright/test';
import { workspaceRoot } from '../graphql/contracts.mjs';

// Serves the built Storybook; run `npm run build:storybook:admin` first (test:visual:admin does).
const test = base.extend<{ storybook: string }>({
  storybook: async ({ browserName }, use) => {
    if (browserName !== 'chromium') {
      throw new Error('Visual review uses Chromium.');
    }
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
    if (!address || typeof address === 'string') {
      throw new Error('Missing Storybook port.');
    }
    await use(`http://127.0.0.1:${String(address.port)}`);
    await new Promise<void>((resolveClose) => {
      server.close(() => {
        resolveClose();
      });
    });
  },
});

const candidates = join(workspaceRoot, 'test-results/storybook-visual-candidates');

const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
} as const;

type ViewportName = keyof typeof viewports;

/** Storybook is English only, so a capture varies by theme, viewport, brand and density. */
interface Capture {
  readonly id: string;
  readonly theme: 'light' | 'dark';
  readonly viewports: readonly ViewportName[];
  /** Brand and density globals; the application's `appTheme` when omitted. */
  readonly brand?: 'cobalt' | 'ember' | 'pine';
  readonly density?: 'compact' | 'comfortable';
  /** Only the viewport: an open drawer is fixed to it, so a full-page capture would cut it. */
  readonly viewportOnly?: boolean;
  /** Wait for a play function to leave this confirmation open before capturing it. */
  readonly confirmation?: string;
  /** Wait for operation feedback triggered by the story before capturing it. */
  readonly toast?: boolean;
}

/** One story in light and dark at the given viewports. */
function bothThemes(id: string, sizes: readonly ViewportName[] = ['desktop']): Capture[] {
  return [
    { id, theme: 'light', viewports: sizes },
    { id, theme: 'dark', viewports: sizes },
  ];
}

// The reviewed set: the introduction, the example pages, foundations, the main patterns,
// PrimeNG coverage and the shell.
const captures: readonly Capture[] = [
  { id: 'start-here--introduction', theme: 'light', viewports: ['desktop'] },
  ...[
    'examples-monitoring-overview--default',
    'examples-fleet-vehicles--default',
    'examples-fleet-vehicle-profile--overview',
    'examples-fleet-driver-scorecard--default',
    'examples-authentication-login--default',
    'examples-service-maintenance--default',
    'examples-settings--general',
    'examples-settings--vehicle-groups',
  ].flatMap((story) => bothThemes(story, ['desktop', 'mobile'])),
  ...[
    'examples-monitoring-alerts--open-alert',
    'examples-monitoring-trips--trip-drawer',
    'examples-fleet-vehicles--edit',
    'examples-fleet-odometer--default',
    'examples-service-service-completion--default',
    'examples-fleet-drivers--view',
    'examples-fleet-devices--edit',
  ].flatMap((story) =>
    bothThemes(story, ['desktop', 'mobile']).map((capture) => ({ ...capture, viewportOnly: true })),
  ),
  ...['examples-fleet-vehicles--loading', 'examples-fleet-vehicles--empty'].flatMap((story) =>
    bothThemes(story),
  ),
  ...[
    'colors',
    'brand-variants',
    'typography',
    'spacing-and-density',
    'radii-and-borders',
    'status-tones',
    'categorical-palette',
    'breakpoints',
  ].flatMap((story) => bothThemes(`design-system-foundations--${story}`)),
  ...[
    'tablepanel--rows',
    'tablepanel--single-page',
    'tablepanel--loading',
    'tablepanel--empty',
    'tablepanel--rows-error',
    'tablepanel--selection-with-progress',
    'drawer--edit',
    'drawer--view',
    'drawer--server-field-errors',
    'drawer--dirty-with-confirm',
    'kpistrip--deltas',
    'kpistrip--error-state',
    'filterbuilder--with-conditions',
    'list-sort--field-and-direction',
    'emptystate--all-kinds',
    'charts--charts',
    'pageheader--detail-with-back-link',
    'formfield--variants',
  ].flatMap((story) => bothThemes(`design-system-patterns-${story}`)),
  ...['confirm-from-row', 'confirm-delete-selection', 'confirm-long-selection'].flatMap((story) =>
    bothThemes(`design-system-patterns-tablepanel--${story}`, ['desktop', 'mobile']).map(
      (capture) => ({ ...capture, viewportOnly: true, confirmation: 'Delete vehicles?' }),
    ),
  ),
  ...[
    'design-system-patterns-tablepanel--notification',
    'design-system-patterns-notifications--long-message',
    'design-system-patterns-notifications--stacked',
    'examples-settings--general-saved',
  ].flatMap((story) =>
    bothThemes(story, ['desktop', 'mobile']).map((capture) => ({
      ...capture,
      viewportOnly: true,
      toast: true,
    })),
  ),
  ...['controls', 'overlays', 'confirm-dialog-story'].flatMap((story) =>
    bothThemes(`design-system-primeng-coverage--${story}`),
  ),
  ...bothThemes('design-system-shell--desktop', ['desktop', 'mobile']),
  ...bothThemes('design-system-shell--rail', ['desktop', 'mobile']),
  ...bothThemes('design-system-shell--mobile-navigation-open', ['mobile']),
];

function globalsOf(capture: Capture): string {
  return [
    `theme:${capture.theme}`,
    ...(capture.brand ? [`brand:${capture.brand}`] : []),
    ...(capture.density ? [`density:${capture.density}`] : []),
  ].join(';');
}

for (const capture of captures) {
  for (const viewportName of capture.viewports) {
    test(`${capture.id} ${globalsOf(capture)} ${viewportName}`, async ({ page, storybook }) => {
      const viewport = viewports[viewportName];
      await page.clock.setFixedTime(new Date('2026-10-18T07:00:00Z'));
      await page.setViewportSize(viewport);
      await page.goto(
        `${storybook}/iframe.html?id=${capture.id}&viewMode=story&globals=${globalsOf(capture)}`,
      );
      // Drawer and dialog stories render into the body, so the story root may have no size.
      await expect(page.locator('#storybook-root > *').first()).toBeAttached();
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
      if (capture.confirmation || capture.toast) {
        await expect(page.locator('#storybook-root')).toHaveAttribute(
          'data-story-ready',
          capture.id,
        );
      }
      if (capture.confirmation) {
        await expect(page.getByRole('alertdialog', { name: capture.confirmation })).toBeVisible();
      }
      if (capture.toast) {
        await expect(page.locator('.p-toast-message').first()).toBeVisible();
      }
      const name = [
        capture.id,
        capture.theme,
        ...(capture.brand ? [capture.brand] : []),
        ...(capture.density ? [capture.density] : []),
        `${viewportName}.png`,
      ].join('--');
      // Every run keeps a reviewable candidate, including when no baseline was approved yet.
      const fullPage = !capture.viewportOnly;
      const candidate = await page.screenshot({
        fullPage,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      });
      await mkdir(candidates, { recursive: true });
      await writeFile(join(candidates, name), candidate);
      await test.info().attach('candidate', { body: candidate, contentType: 'image/png' });
      if (capture.toast) {
        expect(await page.locator('.p-toast-close-button:focus').count()).toBe(0);
      }
      await expect(page).toHaveScreenshot(name, { fullPage });
    });
  }
}
