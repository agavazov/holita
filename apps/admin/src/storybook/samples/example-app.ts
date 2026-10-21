import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AdminShell } from '../../app/layout/admin-shell';
import type {
  LanguageOption,
  ShellAccount,
  ShellNotification,
} from '../../app/layout/admin-topbar';
import { navigationContext, type NavGroup } from '../../app/layout/navigation';
import { PageRecord } from '../../app/layout/page-record';
import type { LeavableDrawer } from '../../app/ui/drawer/leave-drawer.guard';
import { defaultBranchId, fixtureBranches, fixtureTenant } from '../session-fixtures';
import {
  sampleAlerts,
  sampleDevices,
  sampleNow,
  sampleServiceTasks,
  vehicleById,
} from './fleet-samples';
import { exampleRoutes } from './pages/example-routes';
import { SampleDrivers } from './sample-drivers';

/** Sample entries only: Storybook stays in English and the language menu changes nothing. */
export const sampleLanguages: readonly LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'bg', label: 'Български' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
];

function link(...path: string[]): readonly string[] {
  return ['/', 'examples', ...path];
}

function leavable(component: unknown): component is LeavableDrawer {
  return (
    component !== null &&
    typeof component === 'object' &&
    'canLeave' in component &&
    typeof component.canLeave === 'function'
  );
}

/** The target Fleet navigation the example pages illustrate. */
export const exampleNavigation: readonly NavGroup[] = [
  {
    id: 'monitoring',
    label: 'Monitoring',
    items: [
      { id: 'overview', label: 'Overview', icon: 'th-large', link: link('overview') },
      { id: 'alerts', label: 'Alerts', icon: 'bell', link: link('alerts') },
      { id: 'trips', label: 'Trips', icon: 'directions', link: link('trips') },
    ],
  },
  {
    id: 'fleet',
    label: 'Fleet',
    items: [
      { id: 'vehicles', label: 'Vehicles', icon: 'truck', link: link('vehicles') },
      { id: 'drivers', label: 'Drivers', icon: 'id-card', link: link('drivers') },
      { id: 'devices', label: 'Devices', icon: 'mobile', link: link('devices') },
      { id: 'maintenance', label: 'Maintenance', icon: 'wrench', link: link('maintenance') },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'groups', label: 'Vehicle groups', icon: 'tags', link: link('settings', 'groups') },
      { id: 'general', label: 'General', icon: 'info-circle', link: link('settings', 'general') },
    ],
  },
];

/** A sample account: the profile menu's heading. */
export const sampleAccount: ShellAccount = {
  name: 'Elena Petrova',
  detail: 'Fleet manager · Demo Logistics Ltd',
};

interface SampleNotification extends ShellNotification {
  readonly link: readonly string[];
  readonly queryParams?: Readonly<Record<string, string>>;
}

/** Sample notifications from the sample alerts, service plan and trackers; each opens its record. */
export function sampleNotifications(): readonly SampleNotification[] {
  const minute = 60_000;
  const critical = sampleAlerts.filter(
    (alert) => alert.status === 'OPEN' && alert.severity === 'CRITICAL',
  );
  const overdue = sampleServiceTasks.find((task) => task.urgency === 'OVERDUE');
  const offline = sampleDevices.filter((device) => device.status === 'OFFLINE').length;
  return [
    ...critical.slice(0, 2).map((alert, index) => ({
      id: `alert-${alert.id}`,
      title: `${alert.kind} · ${vehicleById(alert.vehicleId)?.plate ?? '—'}`,
      detail: alert.detail,
      at: alert.occurredAt,
      unread: index === 0,
      link: link('alerts'),
      queryParams: { drawer: alert.id },
    })),
    ...(overdue
      ? [
          {
            id: `task-${overdue.id}`,
            title: `${overdue.kind} overdue · ${vehicleById(overdue.vehicleId)?.plate ?? '—'}`,
            detail: 'Plan the workshop visit.',
            at: new Date(sampleNow - 95 * minute).toISOString(),
            unread: true,
            link: link('maintenance'),
            queryParams: { drawer: overdue.id },
          },
        ]
      : []),
    {
      id: 'devices-offline',
      title: `${String(offline)} trackers offline`,
      detail: 'No connection for more than 48 hours.',
      at: new Date(sampleNow - 6 * 60 * minute).toISOString(),
      unread: false,
      link: link('devices'),
    },
  ];
}
/**
 * The example pages inside the real shell, with their own routes: the sidebar switches pages and
 * page hosts own local sample state; Drivers shares its records with the scorecard. Story-only.
 */
@Component({
  selector: 'holita-example-app',
  imports: [AdminShell, RouterOutlet],
  providers: [SampleDrivers],
  template: `
    <holita-admin-shell
      [branches]="branches"
      [branchId]="branchId()"
      language="en"
      [languages]="languages"
      [tenantName]="tenant()"
      [account]="account()"
      [notifications]="notifications()"
      (notificationOpen)="openNotification($event)"
      (notificationsRead)="markAllRead()"
      (signOut)="signOut()"
      [navigation]="navigation"
      [context]="context()"
    >
      <router-outlet [routerOutletData]="branchName()" />
    </holita-admin-shell>
  `,
})
export class ExampleApp {
  readonly url = input.required<string>();
  readonly branches = [...fixtureBranches];
  readonly branchId = input<string>(defaultBranchId);
  readonly branchName = computed(
    () =>
      this.branches.find((branch) => branch.id === this.branchId())?.name ??
      fixtureBranches[0].name,
  );
  readonly tenant = input<string>(fixtureTenant.name);
  readonly signedOut = output();
  readonly languages = sampleLanguages;
  readonly navigation = exampleNavigation;
  readonly account = computed(() => ({
    ...sampleAccount,
    detail: `Fleet manager · ${this.tenant()}`,
  }));
  readonly notifications = signal<readonly SampleNotification[]>(sampleNotifications());
  private readonly router = inject(Router);
  private readonly outlet = viewChild(RouterOutlet);
  private readonly pageRecord = inject(PageRecord);
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url.split(/[?#]/)[0] ?? ''),
    ),
    { initialValue: '' },
  );
  readonly context = computed(() => {
    const context = navigationContext(exampleNavigation, this.path());
    return context ? { ...context, record: this.pageRecord.label() } : null;
  });

  constructor() {
    this.router.resetConfig(exampleRoutes);
    effect(() => {
      void this.router.navigateByUrl(this.url());
    });
  }

  protected openNotification(id: string): void {
    const notification = this.notifications().find((item) => item.id === id);
    if (!notification) {
      return;
    }
    this.notifications.update((items) =>
      items.map((item) => (item.id === id ? { ...item, unread: false } : item)),
    );
    void this.router.navigate([...notification.link], {
      queryParams: notification.queryParams ?? {},
    });
  }

  protected markAllRead(): void {
    this.notifications.update((items) => items.map((item) => ({ ...item, unread: false })));
  }

  protected async signOut(): Promise<void> {
    const component: unknown = this.outlet()?.isActivated ? this.outlet()?.component : null;
    if (leavable(component) && !(await component.canLeave())) {
      return;
    }
    this.signedOut.emit();
  }
}

/** Story render function: the example app opened at an example path, e.g. `vehicles`. */
export function exampleAt(path: string) {
  return () => ({
    props: { url: `/examples/${path}` },
    moduleMetadata: { imports: [ExampleApp] },
    template: '<holita-example-app [url]="url" />',
  });
}
