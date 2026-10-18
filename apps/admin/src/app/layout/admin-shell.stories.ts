import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test';
import { defaultBranchId, fixtureBranches, fixtureTenant } from '../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../storybook/story-config';
import { KpiStrip } from '../ui/kpi/kpi-strip';
import { KpiTile } from '../ui/kpi/kpi-tile';
import { PageHeader } from '../ui/page-header/page-header';
import { TablePanel } from '../ui/table-panel/table-panel';
import { UI_LANGUAGE } from '../ui/ui-language';
import { adminNavigation } from '../workspace/admin-navigation';
import { AdminShell } from './admin-shell';
import { navigationContext } from './navigation';

const vehicles = `${defaultBranchId}/fleet/vehicles`;
/** The routed application bootstraps and discovers Branches before the workspace appears. */
const appReady = { timeout: 10_000 };

const rows = [
  { id: '1', plate: 'CB 1001 AX', model: 'MAN TGX 18.510', status: 'Активно', odometer: '412 330' },
  { id: '2', plate: 'CB 1002 AX', model: 'Volvo FH 500', status: 'Активно', odometer: '388 041' },
  { id: '3', plate: 'CB 1003 AX', model: 'DAF XF 480', status: 'В сервиз', odometer: '501 920' },
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
      [branches]="branches"
      [branchId]="branchId"
      [language]="language()"
      [languageUrl]="languageUrl()"
      [tenantName]="tenant"
      [navigation]="navigation()"
      [context]="context()"
    >
      <holita-page-header
        [eyebrow]="context()?.group ?? ''"
        [title]="context()?.page ?? ''"
        [count]="46"
        description="Автопарк София · данни към 18.10.2026 09:58"
      >
        <button headerActions pButton type="button">Ново превозно средство</button>
      </holita-page-header>
      <holita-kpi-strip label="Обобщение">
        <holita-kpi-tile label="В експлоатация" value="38" secondary="в сервиз: 4" />
        <holita-kpi-tile label="Пробег, 7 дни" value="18 420" unit="км" />
        <holita-kpi-tile label="Отворени аларми" value="7" tone="danger" />
        <holita-kpi-tile label="Ниско гориво" value="3" tone="warn" />
      </holita-kpi-strip>
      <holita-table-panel
        heading="Превозни средства"
        [total]="46"
        [view]="{ kind: 'rows' }"
        [page]="{ page: 1, pageSize: 20, total: 46 }"
      >
        <p-table [value]="rows" dataKey="id">
          <ng-template #header>
            <tr>
              <th scope="col">Номер</th>
              <th scope="col">Модел</th>
              <th scope="col">Статус</th>
              <th scope="col" class="app-num">Пробег, км</th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td>{{ row.plate }}</td>
              <td>{{ row.model }}</td>
              <td>
                <p-tag
                  [severity]="row.status === 'Активно' ? 'success' : 'warn'"
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
  readonly language = inject(UI_LANGUAGE);
  readonly branches = [...fixtureBranches];
  readonly branchId = defaultBranchId;
  readonly tenant = fixtureTenant.name;
  readonly rows = rows;
  readonly navigation = computed(() => adminNavigation(this.language(), defaultBranchId, true));
  readonly context = computed(() =>
    navigationContext(this.navigation(), `/${this.language()}/${vehicles}`),
  );
  private readonly router = inject(Router);
  readonly languageUrl = computed(() =>
    this.router.parseUrl(`/${this.language() === 'bg' ? 'en' : 'bg'}/${vehicles}`),
  );

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
  return (args, context) => ({
    ...render(args, context),
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
        expect(canvas.getByRole('link', { name: /^(Автомобили|Vehicles)$/ })).toHaveAttribute(
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
    await userEvent.click(
      canvas.getByRole('button', { name: /^(Toggle navigation|Отвори или затвори навигацията)$/ }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByRole('complementary', { name: /^(Navigation|Навигация)$/ })).toBeVisible(),
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
