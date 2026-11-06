import { Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { defaultBranchId, fixtureBranches, fixtureTenant } from '../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../storybook/story-config';
import { KpiStrip } from '../ui/kpi/kpi-strip';
import { KpiTile } from '../ui/kpi/kpi-tile';
import { PageHeader } from '../ui/page-header/page-header';
import { TablePanel } from '../ui/table-panel/table-panel';
import { UI_LANGUAGE } from '../ui/ui-language';
import { adminNavigation } from '../workspace/admin-navigation';
import { pageMetadata } from '../workspace/page-metadata';
import { AdminShell } from './admin-shell';
import type { LanguageOption, ShellAccount, ShellNotification } from './admin-topbar';
import { navigationContext } from './navigation';

const vehicles = `${defaultBranchId}/fleet/vehicles`;

/** Sample language menu; use the Storybook Language toolbar to rebuild the preview. */
const languages: readonly LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'bg', label: 'Български' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
];

const account: ShellAccount = {
  name: 'Elena Petrova',
  detail: `Fleet manager · ${fixtureTenant.name}`,
};

/** Two unread notifications and a read one. */
const notifications: readonly ShellNotification[] = [
  {
    id: 'alert-a002',
    title: 'Device 359632100000001 recorded fault code P0299 for CA 1260 TE.',
    category: 'device',
    tone: 'warn',
    at: '2026-10-18T02:43:41.189Z',
    unread: true,
  },
  {
    id: 'alert-a003',
    title: 'Critical alert “Low oil pressure” opened for CA 1038 TE.',
    category: 'alert',
    tone: 'danger',
    at: '2026-10-18T05:25:00.000Z',
    unread: true,
  },
  {
    id: 'command-c001',
    title: 'The current-data command for device 359632100000001 was confirmed.',
    category: 'command',
    tone: 'success',
    at: '2026-10-18T01:00:00.000Z',
    unread: false,
  },
];

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
      [notificationUnreadCount]="2"
      [notificationSeeAllLink]="['/', language(), branchId, 'fleet', 'notifications']"
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
  readonly section = input<'vehicles' | 'devices' | 'dashboard/problems' | 'settings/general'>(
    'vehicles',
  );
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
  readonly account = account;
  readonly notifications = input<readonly ShellNotification[]>(notifications);
  readonly branchId = defaultBranchId;
  readonly tenant = fixtureTenant.name;
  readonly rows = rows;
  readonly languages = languages;
  readonly navigation = computed(() => adminNavigation(this.language(), defaultBranchId, true));
  private readonly path = computed(
    () => `/${this.language()}/${defaultBranchId}/fleet/${this.section()}`,
  );
  readonly context = computed(() => {
    const context =
      pageMetadata(this.language(), this.path()) ??
      navigationContext(this.navigation(), this.path());
    if (!context || !this.longNames()) {
      return context;
    }
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
    effect(() => {
      void this.router.navigateByUrl(this.path());
    });
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
};

export const DashboardNavigation: Story = {
  name: 'Dashboard tabs keep Dashboard selected',
  render: () => ({
    moduleMetadata: { imports: [ShellPreview] },
    template: '<holita-shell-preview section="dashboard/problems" />',
  }),
};

export const DevicesNavigation: Story = {
  name: 'Devices navigation',
  render: () => ({
    moduleMetadata: { imports: [ShellPreview] },
    template: '<holita-shell-preview section="devices" />',
  }),
};

export const SettingsNavigation: Story = {
  name: 'Settings navigation',
  render: () => ({
    moduleMetadata: { imports: [ShellPreview] },
    template: '<holita-shell-preview section="settings/general" />',
  }),
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

export const Mobile: Story = {
  name: 'Mobile',
  render: preview,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const FleetDisabled: Story = {
  name: 'Fleet disabled',
  render: routed(vehicles),
  parameters: { holita: { fleetEnabled: false } satisfies StoryFixtures },
};

export const UnknownBranch: Story = {
  name: 'Unknown Branch',
  render: routed('not-a-branch/fleet/vehicles'),
};

export const BranchDiscoveryLoading: Story = {
  name: 'Branch discovery loading',
  render: routed(vehicles),
  parameters: {
    holita: { scenario: { failures: { AdminBranches: 'pending' } } } satisfies StoryFixtures,
  },
};

export const BranchDiscoveryError: Story = {
  name: 'Branch discovery error',
  render: routed(vehicles),
  parameters: {
    holita: { scenario: { failures: { AdminBranches: 'network' } } } satisfies StoryFixtures,
  },
};

const longNamesPreview: NonNullable<Story['render']> = () => ({
  moduleMetadata: { imports: [ShellPreview] },
  template: '<holita-shell-preview [longNames]="true" />',
});

export const LongNamesMobile: Story = {
  name: 'Long names on a phone',
  render: longNamesPreview,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
