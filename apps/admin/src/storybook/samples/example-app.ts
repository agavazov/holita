import { Component, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AdminShell } from '../../app/layout/admin-shell';
import type { LanguageOption } from '../../app/layout/admin-topbar';
import { navigationContext, type NavGroup } from '../../app/layout/navigation';
import { defaultBranchId, fixtureBranches, fixtureTenant } from '../session-fixtures';
import { exampleRoutes } from './pages/example-routes';

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
    ],
  },
  {
    id: 'service',
    label: 'Service',
    items: [{ id: 'maintenance', label: 'Maintenance', icon: 'wrench', link: link('maintenance') }],
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

/**
 * The example pages inside the real shell, with their own routes: the sidebar switches pages and
 * every page keeps its state until the story is reloaded. Story-only.
 */
@Component({
  selector: 'holita-example-app',
  imports: [AdminShell, RouterOutlet],
  template: `
    <holita-admin-shell
      [branches]="branches"
      [branchId]="branchId"
      language="en"
      [languages]="languages"
      [tenantName]="tenant"
      [navigation]="navigation"
      [context]="context()"
    >
      <router-outlet />
    </holita-admin-shell>
  `,
})
export class ExampleApp {
  readonly url = input.required<string>();
  readonly branches = [...fixtureBranches];
  readonly branchId = defaultBranchId;
  readonly tenant = fixtureTenant.name;
  readonly languages = sampleLanguages;
  readonly navigation = exampleNavigation;
  private readonly router = inject(Router);
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url.split(/[?#]/)[0] ?? ''),
    ),
    { initialValue: '' },
  );
  readonly context = computed(() => navigationContext(exampleNavigation, this.path()));

  constructor() {
    this.router.resetConfig(exampleRoutes);
    effect(() => {
      void this.router.navigateByUrl(this.url());
    });
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
