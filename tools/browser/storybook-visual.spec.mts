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

const candidates = join(workspaceRoot, '.references/review/storybook-visual-candidates');

const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
} as const;

type ViewportName = keyof typeof viewports;

/** Each story fixes its language; captures vary by theme, viewport, brand and density. */
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
  /** Keep fixed shell chrome at the top after a long-page form interaction. */
  readonly resetScroll?: boolean;
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
  ...bothThemes('design-system-karma-controls--default', ['desktop', 'mobile']),
  ...bothThemes('design-system-karma-controls--invalid-filters', ['desktop', 'mobile']),
  ...bothThemes('admin-karma-client-trucks--project', ['desktop', 'mobile']),
  ...bothThemes('design-system-patterns-responsive-table--identity-and-actions', [
    'desktop',
    'mobile',
  ]),
  ...(['cobalt', 'ember', 'pine'] as const).flatMap((brand) =>
    (['compact', 'comfortable'] as const).flatMap((density) =>
      bothThemes('design-system-patterns-responsive-table--identity-and-actions', ['mobile']).map(
        (capture) => ({ ...capture, brand, density }),
      ),
    ),
  ),
  ...['edata', 'edata-source-fields', 'events'].flatMap((section) =>
    bothThemes(`admin-karma-client-record-details--${section}`, ['desktop', 'mobile']).map(
      (capture) => ({ ...capture, viewportOnly: true }),
    ),
  ),
  ...['driving-profile', 'truck-overview'].flatMap((section) =>
    bothThemes(`admin-karma-client-record-details--${section}`, ['desktop', 'mobile']),
  ),
  ...bothThemes('admin-karma-client-truck-workspace--location', ['desktop', 'mobile']),
  ...(['cobalt', 'ember', 'pine'] as const).flatMap((brand) =>
    (['compact', 'comfortable'] as const).flatMap((density) =>
      bothThemes('admin-karma-client-truck-workspace--location', ['desktop', 'mobile']).map(
        (capture) => ({ ...capture, brand, density }),
      ),
    ),
  ),
  ...bothThemes('admin-fleet-devices--diagnostics', ['desktop', 'mobile']).map((capture) => ({
    ...capture,
    viewportOnly: true,
  })),
  ...bothThemes('admin-karma-client-maps--location', ['desktop', 'mobile']),
  ...bothThemes('admin-karma-client-maps--trip-endpoints', ['desktop', 'mobile']),
  ...[
    'admin-fleet-vehicles--default',
    'admin-fleet-devices--default',
    'admin-fleet-drivers--default',
    'admin-fleet-vehicle-profile--overview',
    'admin-monitoring-overview--default',
    'admin-monitoring-alerts--default',
    'admin-monitoring-trips--default',
    'admin-service-maintenance--default',
    'admin-settings-vehicle-groups--default',
    'admin-settings-general--default',
    'admin-fleet-device-configuration-states--reconciliation-needed',
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
    'admin-fleet-odometer-settings--miles-and-new-york-time',
    'admin-fleet-odometer-settings--inactive',
    'admin-fleet-odometer-settings--no-later-time',
    'admin-fleet-devices--installed-at-calendar',
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
  ...bothThemes('admin-fleet-device-configuration--default', ['desktop', 'mobile']),
  ...bothThemes('admin-fleet-device-configuration--waiting', ['desktop', 'mobile']),
  ...(['cobalt', 'ember', 'pine'] as const).flatMap((brand) =>
    (['compact', 'comfortable'] as const).flatMap((density) =>
      brand === 'cobalt' && density === 'compact'
        ? []
        : bothThemes('admin-fleet-device-configuration--zero-interval-confirmation', [
            'desktop',
            'mobile',
          ]).map((capture) => ({ ...capture, brand, density, resetScroll: true })),
    ),
  ),
  ...[
    'invalid-interval-focus',
    'write-failure',
    'write-waiting',
    'write-uncertain',
    'zero-interval-confirmation',
    'row-action-draft',
  ].flatMap((story) =>
    bothThemes(`admin-fleet-device-configuration--${story}`, ['desktop', 'mobile']).map(
      (capture) => ({ ...capture, resetScroll: true }),
    ),
  ),
  {
    id: 'admin-fleet-device-configuration--edit-mobile-dark',
    theme: 'dark',
    viewports: ['mobile'],
    resetScroll: true,
  },
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
      const browserErrors: string[] = [];
      page.on('pageerror', (error) => browserErrors.push(error.message));
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
      // Fixture quiet alone can precede lazy routing; the preview marks every completed story.
      await expect(page.locator('#storybook-root')).toHaveAttribute('data-story-ready', capture.id);
      // Interactive configuration stories must reach the reviewed outcome before capture.
      if (capture.id === 'admin-fleet-device-configuration--zero-interval-confirmation') {
        await expect(
          page.getByRole('checkbox', { name: /I intend to use the special zero interval/ }),
        ).toBeChecked();
        await expect(
          page.getByText('Confirm the special meaning of interval zero.', { exact: true }),
        ).toHaveCount(0);
      }
      if (capture.id === 'admin-fleet-device-configuration--row-action-draft') {
        await expect(page.getByRole('spinbutton', { name: /New reporting interval/ })).toHaveValue(
          '45',
        );
        await expect(
          page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true }),
        ).toBeHidden();
      }
      if (capture.id === 'admin-fleet-device-configuration--invalid-interval-focus') {
        await expect(
          page.getByRole('spinbutton', { name: /New reporting interval/ }),
        ).toHaveAttribute('aria-invalid', 'true');
      }
      if (capture.id === 'admin-fleet-device-configuration--edit-mobile-dark') {
        await expect(page.getByRole('spinbutton', { name: /New reporting interval/ })).toHaveValue(
          '60',
        );
      }
      if (capture.id === 'admin-fleet-device-configuration--write-failure') {
        await expect(
          page.getByText('The parameter change could not be confirmed as saved.', { exact: false }),
        ).toBeVisible();
        await expect(page.getByRole('spinbutton', { name: /New reporting interval/ })).toHaveValue(
          '60',
        );
      }
      if (capture.confirmation) {
        await expect(page.getByRole('alertdialog', { name: capture.confirmation })).toBeVisible();
      }
      if (capture.toast) {
        const toast = page.locator('.p-toast-message').first();
        await expect(toast).toBeVisible();
        // Pause dismissal through the real hover behavior while both captures are taken.
        await toast.hover();
      }
      if (capture.resetScroll) {
        await page.evaluate(() => {
          window.scrollTo({ top: 0, behavior: 'instant' });
        });
      }
      if (
        capture.id.startsWith('admin-fleet-device-configuration--') &&
        viewportName === 'mobile'
      ) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
        const action = page.getByRole('button', { name: 'Edit interval 65000', exact: true });
        const bounds = await action.boundingBox();
        expect(bounds).not.toBeNull();
        if (bounds) {
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
          const interval = await page
            .getByRole('row')
            .filter({ has: action })
            .getByRole('cell')
            .nth(1)
            .boundingBox();
          expect(interval).not.toBeNull();
          if (interval) {
            expect(interval.x).toBeGreaterThanOrEqual(0);
            expect(interval.x + interval.width).toBeLessThanOrEqual(bounds.x);
          }
        }
      }
      expect(browserErrors).toEqual([]);
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
