import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test';
import {
  sampleAccount,
  sampleLanguages,
  sampleNotifications,
} from '../../storybook/samples/example-app';
import { defaultBranchId, fixtureBranches, fixtureTenant } from '../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../storybook/story-config';
import { KpiStrip } from '../ui/kpi/kpi-strip';
import { KpiTile } from '../ui/kpi/kpi-tile';
import { PageHeader } from '../ui/page-header/page-header';
import { TablePanel } from '../ui/table-panel/table-panel';
import { UI_LANGUAGE } from '../ui/ui-language';
import { adminNavigation } from '../workspace/admin-navigation';
import { AdminShell } from './admin-shell';
import type { ShellNotification } from './admin-topbar';
import { navigationContext } from './navigation';

const vehicles = `${defaultBranchId}/fleet/vehicles`;
/** The routed application bootstraps and discovers Branches before the workspace appears. */
const appReady = { timeout: 10_000 };

const rows = [
  { id: '1', plate: 'CB 1001 AX', model: 'MAN TGX 18.510', status: 'Active', odometer: '412,330' },
  { id: '2', plate: 'CB 1002 AX', model: 'Volvo FH 500', status: 'Active', odometer: '388,041' },
  { id: '3', plate: 'CB 1003 AX', model: 'DAF XF 480', status: 'In service', odometer: '501,920' },
];

/**
 * The shell with the real navigation and a page built from the design-system patterns, without
 * feature data: the frame, sidebar, rail, topbar and mobile navigation are what this story shows.
 */
@Component({
  selector: 'holita-shell-preview',
  imports: [
    AdminShell,
    PageHeader,
    KpiStrip,
    KpiTile,
    TablePanel,
    TableModule,
    Tag,
    ButtonDirective,
  ],
  template: `
    <holita-admin-shell
      [branches]="branches()"
      [branchId]="branchId"
      [language]="language()"
      [languages]="languages"
      [tenantName]="tenant"
      [account]="account"
      [notifications]="notifications()"
      [navigation]="navigation()"
      [context]="context()"
    >
      <holita-page-header
        [eyebrow]="context()?.group ?? ''"
        [title]="context()?.page ?? ''"
        [count]="46"
        description="Sofia Fleet · data as of Oct 18, 2026 09:58"
      >
        <button headerActions pButton type="button">New vehicle</button>
      </holita-page-header>
      <holita-kpi-strip label="Summary">
        <holita-kpi-tile label="In operation" value="38" secondary="in service: 4" />
        <holita-kpi-tile label="Distance, 7 days" value="18,420" unit="km" />
        <holita-kpi-tile label="Open alerts" value="7" tone="danger" />
        <holita-kpi-tile label="Low fuel" value="3" tone="warn" />
      </holita-kpi-strip>
      <holita-table-panel
        heading="Vehicles"
        [total]="46"
        [view]="{ kind: 'rows' }"
        [page]="{ page: 1, pageSize: 20, total: 46 }"
      >
        <p-table [value]="rows" dataKey="id">
          <ng-template #header>
            <tr>
              <th scope="col">Plate</th>
              <th scope="col">Model</th>
              <th scope="col">Status</th>
              <th scope="col" class="app-num">Odometer, km</th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td>{{ row.plate }}</td>
              <td>{{ row.model }}</td>
              <td>
                <p-tag
                  [severity]="row.status === 'Active' ? 'success' : 'warn'"
                  [value]="row.status"
                />
              </td>
              <td class="app-num">{{ row.odometer }}</td>
            </tr>
          </ng-template>
        </p-table>
      </holita-table-panel>
    </holita-admin-shell>
  `,
})
class ShellPreview {
  /** Very long Branch, page and record names: everything stays on one line with an ellipsis. */
  readonly longNames = input(false);
  readonly language = inject(UI_LANGUAGE);
  readonly branches = computed(() =>
    this.longNames()
      ? fixtureBranches.map((branch, index) =>
          index === 0
            ? { ...branch, name: 'Sofia International Logistics Hub — Night Shift Operations' }
            : branch,
        )
      : [...fixtureBranches],
  );
  readonly account = sampleAccount;
  readonly notifications = input<readonly ShellNotification[]>(sampleNotifications());
  readonly branchId = defaultBranchId;
  readonly tenant = fixtureTenant.name;
  readonly rows = rows;
  readonly languages = sampleLanguages;
  readonly navigation = computed(() => adminNavigation(this.language(), defaultBranchId, true));
  readonly context = computed(() => {
    const context = navigationContext(this.navigation(), `/${this.language()}/${vehicles}`);
    if (!context || !this.longNames()) return context;
    return {
      ...context,
      page: 'Vehicles of the international long-haul fleet',
      record:
        'CB 1001 AX · MAN TGX 18.510 · refrigerated trailer for the Sofia – Thessaloniki line',
    };
  });
  private readonly router = inject(Router);

  constructor() {
    // Only the router state matters (the active navigation item); there is no routed outlet.
    void this.router.navigateByUrl(`/${this.language()}/${vehicles}`);
  }
}

const meta: Meta = {
  title: 'Design System/Shell',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const preview: NonNullable<Story['render']> = () => ({
  moduleMetadata: { imports: [ShellPreview] },
  template: '<holita-shell-preview />',
});

/** A routed story of the workspace states (session, Branch discovery, Fleet availability). */
function routed(path: string): NonNullable<Story['render']> {
  const render = routeAt(path);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Desktop: Story = {
  render: preview,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('banner')).toBeVisible();
    await expect(canvas.getByRole('main')).toBeInTheDocument();
    // The router resolves the lazily loaded route chunks before the item becomes active.
    await waitFor(
      () =>
        expect(canvas.getByRole('link', { name: 'Vehicles' })).toHaveAttribute(
          'aria-current',
          'page',
        ),
      appReady,
    );
  },
};

export const Rail: Story = {
  render: preview,
  beforeEach: () => {
    localStorage.setItem('holita.admin.sidebar', 'rail');
    return () => {
      localStorage.removeItem('holita.admin.sidebar');
    };
  },
};

export const MobileNavigationOpen: Story = {
  name: 'Mobile with navigation open',
  render: preview,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle navigation' }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByRole('complementary', { name: 'Navigation' })).toBeVisible(),
    );
  },
};

export const FleetDisabled: Story = {
  name: 'Fleet disabled',
  render: routed(vehicles),
  parameters: { holita: { fleetEnabled: false } satisfies StoryFixtures },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('main')).toBeVisible(), appReady);
  },
};

export const UnknownBranch: Story = {
  name: 'Unknown Branch',
  render: routed('not-a-branch/fleet/vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible(), appReady);
  },
};

export const BranchDiscoveryLoading: Story = {
  name: 'Branch discovery loading',
  render: routed(vehicles),
  parameters: {
    holita: { scenario: { failures: { AdminBranches: 'pending' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('status')).toBeVisible(), appReady);
  },
};

export const BranchDiscoveryError: Story = {
  name: 'Branch discovery error',
  render: routed(vehicles),
  parameters: {
    holita: { scenario: { failures: { AdminBranches: 'network' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('refresh-branches')).toBeEnabled(), appReady);
    // Without Branches the Branch menu says so and does not open.
    const branch = canvas.getByRole('button', { name: 'Branch: No branches available.' });
    await expect(branch).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(branch);
    await expect(branch).toHaveAttribute('aria-expanded', 'false');
    await expect(within(canvasElement.ownerDocument.body).queryByRole('menu')).toBeNull();
  },
};

export const ThemePersistenceWarning: Story = {
  name: 'Theme-persistence warning',
  render: preview,
  beforeEach: () => {
    // The browser refuses the stored theme preference.
    const spy = spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'holita.admin.theme') throw new Error('Storage denied');
      return null;
    });
    return () => {
      spy.mockRestore();
    };
  },
};

/** The Branch menu: the current Branch is checked; choosing it again changes nothing. */
export const BranchMenu: Story = {
  name: 'Branch menu',
  render: preview,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Branch: Sofia Fleet' }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByRole('menuitem', { name: /^Sofia Fleet\W+current choice$/ })).toBeVisible(),
    );
    await expect(body.getByRole('menuitem', { name: 'Plovdiv Fleet' })).toBeVisible();
  },
};

/** Notifications: unread ones are marked and counted in the bell's name. */
export const Notifications: Story = {
  render: preview,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bell = canvas.getByRole('button', { name: /^Notifications, unread: \d+$/ });
    await userEvent.click(bell);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByRole('menuitem', { name: 'Mark all as read' })).toBeVisible(),
    );
  },
};

/** No notifications: the bell's menu states it in its heading, which also names the menu. */
export const NoNotifications: Story = {
  name: 'No notifications',
  render: () => ({
    moduleMetadata: { imports: [ShellPreview] },
    template: '<holita-shell-preview [notifications]="[]" />',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Notifications' }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByRole('menu', { name: 'No new notifications' })).toBeVisible(),
    );
  },
};

/** The account menu: who is signed in, the theme and Sign out. */
export const AccountMenu: Story = {
  name: 'Account menu',
  render: preview,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `Account: ${sampleAccount.name}` }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('menu', { name: sampleAccount.name })).toBeVisible());
    await expect(body.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
    // The theme item is not chosen here: it would store the preference for the next stories. Its
    // label names the theme the toolbar does not show.
    await expect(body.getByRole('menuitem', { name: /^Use (dark|light) theme$/ })).toBeVisible();
  },
};

const longNamesPreview: NonNullable<Story['render']> = () => ({
  moduleMetadata: { imports: [ShellPreview] },
  template: '<holita-shell-preview [longNames]="true" />',
});

/** The breadcrumb and the Branch on one line, each crumb cut with its own ellipsis. */
async function longNamesFit(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const breadcrumb = canvas.getByRole('navigation', { name: 'Breadcrumb' });
  const current = within(breadcrumb).getByText(/^CB 1001 AX/);
  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect(current.scrollWidth).toBeGreaterThan(current.clientWidth);
  // The current crumb keeps its minimum width; the others give way instead.
  await expect(current.clientWidth).toBeGreaterThan(40);
  // Nothing runs past the end of the list, where it would be clipped without an ellipsis.
  await expect(current.getBoundingClientRect().right).toBeLessThanOrEqual(
    within(breadcrumb).getByRole('list').getBoundingClientRect().right,
  );
  await expect(
    within(breadcrumb).getByRole('link', {
      name: 'Vehicles of the international long-haul fleet',
    }),
  ).toBeVisible();
  const branch = canvasElement.querySelector('#active-branch');
  if (!(branch instanceof HTMLElement)) throw new Error('Missing Branch name.');
  await expect(branch.scrollWidth).toBeGreaterThan(branch.clientWidth);
  await expect(breadcrumb.getBoundingClientRect().height).toBeLessThan(40);
}

/** Very long names: the breadcrumb and the Branch stay on one line, cut with an ellipsis. */
export const LongNames: Story = {
  name: 'Long names',
  render: longNamesPreview,
  play: async ({ canvasElement }) => {
    await longNamesFit(canvasElement);
  },
};

/** The narrowest desktop layout (1024px, with the sidebar). */
export const LongNamesNarrowDesktop: Story = {
  name: 'Long names on a narrow desktop',
  render: longNamesPreview,
  globals: { viewport: { value: 'desktop1024', isRotated: false } },
  play: async ({ canvasElement }) => {
    await longNamesFit(canvasElement);
  },
};

export const LongNamesMobile: Story = {
  name: 'Long names on a phone',
  render: longNamesPreview,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: async ({ canvasElement }) => {
    const document = canvasElement.ownerDocument;
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    );
  },
};
